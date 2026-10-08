from datetime import datetime, timezone
import random
import time
import uuid
from collections import Counter
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.word import Word


router = APIRouter(prefix="/api/game", tags=["game"])


# ============================================================
# OYUN AYARLARI
# ============================================================

# 7 etap:
# 4 → 4 → 5 → 5 → 6 → 6 → 7
STAGE_LENGTHS = [4, 4, 5, 5, 6, 6, 7]

# Her etaptaki maksimum tahmin hakkı
STAGE_ATTEMPTS = [6, 6, 5, 5, 5, 5, 6]

# Her etap 60 saniye
STAGE_TIME_LIMIT = 60

TOTAL_STAGES = len(STAGE_LENGTHS)


# Aktif oyunlar
active_games = {}


# ============================================================
# TÜRKÇE ALFABE
# ============================================================

TURKISH_ALPHABET = set(
    "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"
)


# ============================================================
# TÜRKÇE KELİME NORMALİZASYONU
# ============================================================

def normalize_turkish_word(word: str) -> str:
    result = []

    for char in word.strip():
        if char == "i":
            result.append("İ")
        elif char == "ı":
            result.append("I")
        else:
            result.append(char.upper())

    return "".join(result)


# ============================================================
# KALAN SÜRE
# ============================================================

def remaining_seconds(game: dict) -> int:
    elapsed = int(
        time.monotonic() - game["started_at"]
    )

    return max(
        0,
        STAGE_TIME_LIMIT - elapsed
    )


# ============================================================
# DIŞARI GÖNDERİLECEK OYUN BİLGİSİ
# ============================================================

def public_game(game_id: str, game: dict) -> dict:
    return {
        "game_id": game_id,
        "stage": game["stage"],
        "total_stages": TOTAL_STAGES,
        "length": STAGE_LENGTHS[game["stage"] - 1],
        "max_attempts": STAGE_ATTEMPTS[game["stage"] - 1],
        "first_letter": game["first_letter"],
        "score": game["score"],
        "status": game["status"],
        "time_limit": STAGE_TIME_LIMIT,
        "remaining_seconds": remaining_seconds(game),
    }


# ============================================================
# VERİTABANINDAN RASTGELE KELİME
# ============================================================

def get_random_word(
    db: Session,
    length: int,
    first_letter: str | None = None
):
    query = db.query(Word).filter(
        Word.length == length,
        Word.is_active.is_(True),
    )

    if first_letter:
        query = query.filter(
            Word.word.like(f"{first_letter}%")
        )

    words = query.all()

    if not words:
        return None

    return random.choice(words).word


# ============================================================
# HEDEF KELİME FİLTRESİ
# ============================================================

TARGET_BLOCKLIST = {
    "UMUM",
}


def is_good_target_word(word: str) -> bool:
    if word in TARGET_BLOCKLIST:
        return False

    if not all(
        char in TURKISH_ALPHABET
        for char in word
    ):
        return False

    if len(set(word)) == 1:
        return False

    return True


# ============================================================
# TARGET_WORDS.TXT OKUMA
# ============================================================

TARGET_WORDS_FILE = (
    Path(__file__).resolve().parents[2]
    / "target_words.txt"
)


def load_target_words() -> list[str]:
    if not TARGET_WORDS_FILE.exists():
        return []

    with open(
        TARGET_WORDS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        words = []

        for line in file:
            word = normalize_turkish_word(line)

            if word:
                words.append(word)

    return words


# ============================================================
# ETAP İÇİN HEDEF KELİME SEÇ
# ============================================================

def choose_stage_word(
    db: Session,
    stage: int
):
    length = STAGE_LENGTHS[stage - 1]

    target_words = load_target_words()

    target_words = [
        word
        for word in target_words
        if len(word) == length
        and is_good_target_word(word)
    ]

    if not target_words:
        return None, None

    word = random.choice(target_words)

    # 1-6. etap:
    # İlk harf gösterilecek.
    if stage < TOTAL_STAGES:
        return word, word[0]

    # Final:
    # İlk harf gösterilmeyecek.
    return word, None


# ============================================================
# TAHMİNİ DEĞERLENDİR
# ============================================================

def evaluate_guess(
    target: str,
    guess: str
):
    statuses = [
        "absent"
        for _ in target
    ]

    target_counter = Counter(target)

    # Önce doğru konumdaki harfleri bul
    for index, letter in enumerate(guess):

        if letter == target[index]:
            statuses[index] = "correct"
            target_counter[letter] -= 1

    # Sonra doğru harf ama yanlış konum
    for index, letter in enumerate(guess):

        if statuses[index] == "correct":
            continue

        if target_counter[letter] > 0:
            statuses[index] = "present"
            target_counter[letter] -= 1

    # Frontend'in beklediği format
    return [
        {
            "letter": letter,
            "status": statuses[index]
        }
        for index, letter in enumerate(guess)
    ]


# ============================================================
# ETAP OLUŞTUR
# ============================================================

def make_stage(
    db: Session,
    stage: int,
    score: int
):
    target, first_letter = choose_stage_word(
        db,
        stage
    )

    if not target:
        return None

    return {
        "stage": stage,
        "target": target,
        "first_letter": first_letter,
        "guesses": [],
        "attempts_used": 0,
        "score": score,
        "status": "playing",
        "started_at": time.monotonic(),
    }


# ============================================================
# YENİ OYUN
# ============================================================

@router.post("/new")
def new_game():

    db = SessionLocal()

    try:

        game_id = str(uuid.uuid4())

        game = make_stage(
            db,
            stage=1,
            score=0
        )

        if not game:
            return {
                "success": False,
                "message": "Hedef kelime bulunamadı."
            }

        active_games[game_id] = game

        return {
            "success": True,
            "game": public_game(
                game_id,
                game
            )
        }

    finally:
        db.close()


# ============================================================
# OYUN DURUMU
# ============================================================

@router.get("/status/{game_id}")
def game_status(game_id: str):

    game = active_games.get(game_id)

    if not game:
        return {
            "success": False,
            "message": "Oyun bulunamadı."
        }

    return {
        "success": True,
        "game": public_game(
            game_id,
            game
        )
    }


# ============================================================
# TAHMİN
# ============================================================

@router.post("/guess")
def make_guess(payload: dict):

    game_id = payload.get("game_id")
    raw_guess = payload.get("guess", "")

    game = active_games.get(game_id)

    if not game:
        return {
            "success": False,
            "message": "Oyun bulunamadı."
        }

    # --------------------------------------------------------
    # OYUN BİTMİŞSE
    # --------------------------------------------------------

    if game["status"] != "playing":
        return {
            "success": False,
            "message": "Bu oyun artık aktif değil.",
            "game": public_game(
                game_id,
                game
            )
        }

    # --------------------------------------------------------
    # SÜRE KONTROLÜ
    # --------------------------------------------------------

    if remaining_seconds(game) <= 0:

        game["status"] = "lost"

        return {
            "success": False,
            "message": "Süreniz doldu.",
            "game": public_game(
                game_id,
                game
            )
        }

    # --------------------------------------------------------
    # TAHMİNİ NORMALİZE ET
    # --------------------------------------------------------

    guess = normalize_turkish_word(
        str(raw_guess)
    )

    target = game["target"]

    # --------------------------------------------------------
    # KELİME UZUNLUĞU
    # --------------------------------------------------------

    if len(guess) != len(target):

        return {
            "success": False,
            "message": (
                f"Tahmin {len(target)} harfli olmalı."
            ),
            "game": public_game(
                game_id,
                game
            )
        }

    # --------------------------------------------------------
    # SADECE TÜRKÇE HARFLER
    # --------------------------------------------------------

    if not all(
        letter in TURKISH_ALPHABET
        for letter in guess
    ):

        return {
            "success": False,
            "message": "Geçersiz karakter kullandınız.",
            "game": public_game(
                game_id,
                game
            )
        }

    # ========================================================
    # İLK HARF KONTROLÜ
    # ========================================================

    if game["first_letter"] is not None:

        if not guess.startswith(
            game["first_letter"]
        ):

            return {
                "success": False,
                "message": (
                    f"Kelime "
                    f"{game['first_letter']} "
                    f"harfi ile başlamalı."
                ),
                "game": public_game(
                    game_id,
                    game
                )
            }

    # --------------------------------------------------------
    # KELİME SÖZLÜKTE VAR MI?
    # --------------------------------------------------------

    db = SessionLocal()

    try:

        valid_word = db.query(Word).filter(
            Word.word == guess,
            Word.length == len(guess),
            Word.is_active.is_(True)
        ).first()

        if not valid_word:

            return {
                "success": False,
                "message": "Bu kelime sözlükte bulunamadı.",
                "game": public_game(
                    game_id,
                    game
                )
            }

    finally:
        db.close()

    # --------------------------------------------------------
    # TAHMİNİ DEĞERLENDİR
    # --------------------------------------------------------

    result = evaluate_guess(
        target,
        guess
    )

    # Tahmini kaydet
    game["guesses"].append({
        "word": guess,
        "result": result
    })

    game["attempts_used"] += 1

    # --------------------------------------------------------
    # DOĞRU CEVAP
    # --------------------------------------------------------

    if guess == target:

        max_attempts = STAGE_ATTEMPTS[
            game["stage"] - 1
        ]

        gained_score = (
            max_attempts
            - game["attempts_used"]
            + 1
        ) * 100

        game["score"] += gained_score

        # Final etap
        if game["stage"] == TOTAL_STAGES:

            game["status"] = "won"

            return {
                "success": True,
                "correct": True,
                "finished": True,
                "message": "Tebrikler! Oyunu kazandınız!",
                "word": target,
                "result": result,
                "score_gained": gained_score,
                "game": public_game(
                    game_id,
                    game
                )
            }

        # Etap tamamlandı
        game["status"] = "stage_won"

        return {
            "success": True,
            "correct": True,
            "finished": False,
            "message": "Doğru kelime!",
            "word": target,
            "result": result,
            "score_gained": gained_score,
            "game": public_game(
                game_id,
                game
            )
        }

    # --------------------------------------------------------
    # YANLIŞ TAHMİN
    # --------------------------------------------------------

    max_attempts = STAGE_ATTEMPTS[
        game["stage"] - 1
    ]

    if game["attempts_used"] >= max_attempts:

        game["status"] = "lost"

        return {
            "success": True,
            "correct": False,
            "finished": True,
            "message": "Tahmin hakkınız bitti.",
            "word": target,
            "result": result,
            "game": public_game(
                game_id,
                game
            )
        }

    # --------------------------------------------------------
    # OYUN DEVAM EDİYOR
    # --------------------------------------------------------

    return {
        "success": True,
        "correct": False,
        "finished": False,
        "message": "Tahmin değerlendirildi.",
        "result": result,
        "attempts_used": game["attempts_used"],
        "game": public_game(
            game_id,
            game
        )
    }


# ============================================================
# SÜRE DOLDU
# ============================================================

@router.post("/timeout/{game_id}")
def timeout_game(game_id: str):

    game = active_games.get(game_id)

    if not game:
        return {
            "success": False,
            "message": "Oyun bulunamadı."
        }

    if game["status"] == "playing":

        game["status"] = "lost"

    return {
        "success": True,
        "message": "Süre doldu.",
        "word": game["target"],
        "game": public_game(
            game_id,
            game
        )
    }


# ============================================================
# SONRAKİ ETAP
# ============================================================

@router.post("/next/{game_id}")
def next_stage(game_id: str):

    game = active_games.get(game_id)

    if not game:
        return {
            "success": False,
            "message": "Oyun bulunamadı."
        }

    if game["status"] != "stage_won":

        return {
            "success": False,
            "message": "Sonraki etaba geçilemiyor.",
            "game": public_game(
                game_id,
                game
            )
        }

    db = SessionLocal()

    try:

        next_stage_number = (
            game["stage"] + 1
        )

        new_stage = make_stage(
            db,
            stage=next_stage_number,
            score=game["score"]
        )

        if not new_stage:

            return {
                "success": False,
                "message": "Yeni etap oluşturulamadı."
            }

        active_games[game_id] = new_stage

        return {
            "success": True,
            "game": public_game(
                game_id,
                new_stage
            )
        }

    finally:
        db.close()

