from pathlib import Path

from app.database.database import SessionLocal
from app.models.word import Word


BASE_DIR = Path(__file__).resolve().parent

WORDS_FILE = BASE_DIR / "words.txt"


# =========================================================
# TÜRKÇE NORMALİZASYON
# =========================================================

def normalize_word(word: str) -> str:

    word = word.strip()

    result = []

    for char in word:

        if char == "i":
            result.append("İ")

        elif char == "ı":
            result.append("I")

        else:
            result.append(char.upper())

    return "".join(result)


# =========================================================
# KELİME GEÇERLİ Mİ?
# =========================================================

def is_valid_word(word: str) -> bool:

    allowed_letters = (
        "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"
    )

    if not 3 <= len(word) <= 7:
        return False

    if not all(
        letter in allowed_letters
        for letter in word
    ):
        return False

    return True


# =========================================================
# WORDS.TXT OKU
# =========================================================

def load_words_from_file():

    if not WORDS_FILE.exists():

        print(
            "words.txt dosyası bulunamadı."
        )

        return []

    words = set()

    with open(
        WORDS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        for line in file:

            word = normalize_word(line)

            if is_valid_word(word):

                words.add(word)

    return sorted(words)


# =========================================================
# VERİTABANINA AKTAR
# =========================================================

def seed_database():

    words = load_words_from_file()

    if not words:

        print(
            "Aktarılabilecek geçerli kelime bulunamadı."
        )

        return

    db = SessionLocal()

    added_count = 0
    existing_count = 0

    try:

        for word in words:

            existing_word = (
                db.query(Word)
                .filter(
                    Word.word == word
                )
                .first()
            )

            if existing_word:

                existing_count += 1

                continue

            new_word = Word(
                word=word,
                length=len(word),
                category="Genel",
                difficulty="Orta",
                is_active=True
            )

            db.add(new_word)

            added_count += 1

        db.commit()

    finally:

        db.close()

    print()

    print(
        "================================"
    )

    print(
        "KELİME 5 - KELİME AKTARIMI"
    )

    print(
        "================================"
    )

    print(
        f"Dosyadaki geçerli kelime: {len(words)}"
    )

    print(
        f"Yeni eklenen kelime:      {added_count}"
    )

    print(
        f"Zaten bulunan kelime:     {existing_count}"
    )

    print(
        "================================"
    )

    print(
        "Uzunluk dağılımı:"
    )

    for length in range(3, 8):

        count = sum(
            1
            for word in words
            if len(word) == length
        )

        print(
            f"{length} harfli: {count}"
        )

    print(
        "================================"
    )

    print(
        "Aktarım tamamlandı."
    )


if __name__ == "__main__":

    seed_database()