from pathlib import Path
from urllib.request import urlopen

DICTIONARY_URL = (
    "https://raw.githubusercontent.com/"
    "CanNuhlar/Turkce-Kelime-Listesi/master/"
    "turkce_kelime_listesi.txt"
)

COMMON_WORDS_URLS = [
    "https://raw.githubusercontent.com/"
    "Esat-Karakaya/Turkish_common_words/master/isimler.txt",

    "https://raw.githubusercontent.com/"
    "Esat-Karakaya/Turkish_common_words/master/fiiller.txt",

    "https://raw.githubusercontent.com/"
    "Esat-Karakaya/Turkish_common_words/master/sifatlar.txt",
]

BASE_DIR = Path(__file__).resolve().parent

WORDS_FILE = BASE_DIR / "words.txt"
TARGET_WORDS_FILE = BASE_DIR / "target_words.txt"

ALLOWED_LETTERS = set(
    "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"
)


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


def is_valid_word(word: str) -> bool:
    if not 4 <= len(word) <= 7:
        return False

    if not all(letter in ALLOWED_LETTERS for letter in word):
        return False

    if not word.isalpha():
        return False

    return True


def download_text(url: str) -> str:
    with urlopen(url, timeout=30) as response:
        data = response.read()

    return data.decode("utf-8")


def process_dictionary(raw_text: str) -> list[str]:
    words = set()

    for line in raw_text.splitlines():
        word = normalize_word(line)

        word = word.strip("\"'“”‘’ ")

        if is_valid_word(word):
            words.add(word)

    return sorted(words)


def process_common_words(raw_text: str) -> set[str]:
    words = set()

    for line in raw_text.splitlines():
        word = normalize_word(line)

        word = word.strip("\"'“”‘’ ")

        if is_valid_word(word):
            words.add(word)

    return words


def save_words(words: list[str], file_path: Path):
    with open(file_path, "w", encoding="utf-8") as file:
        for word in words:
            file.write(word + "\n")


def create_target_words(dictionary_words: list[str]) -> list[str]:

    print()
    print("Yaygın Türkçe kelimeler indiriliyor...")

    common_words = set()

    for url in COMMON_WORDS_URLS:
        try:
            print(f"Kaynak: {url}")

            raw_text = download_text(url)

            new_words = process_common_words(raw_text)

            common_words.update(new_words)

            print(f"  Bulunan uygun kelime: {len(new_words)}")

        except Exception as error:
            print(f"  Bu kaynak indirilemedi: {error}")

    dictionary_set = set(dictionary_words)

    target_words = sorted(
        common_words.intersection(dictionary_set)
    )

    return target_words


def print_statistics(words: list[str], title: str):

    print()
    print("========================================")
    print(title)
    print("========================================")

    print(f"Toplam kelime: {len(words)}")

    for length in range(4, 8):
        count = sum(
            1 for word in words
            if len(word) == length
        )

        print(f"{length} harfli: {count}")

    print("========================================")


def main():

    print()
    print("========================================")
    print("KELİME 5 - KELİME VERİ SETİ")
    print("========================================")

    # -----------------------------------------
    # 1. GENİŞ SÖZLÜK
    # -----------------------------------------

    print()
    print("Ana Türkçe sözlük indiriliyor...")

    try:
        raw_dictionary = download_text(DICTIONARY_URL)

    except Exception as error:
        print()
        print("Ana sözlük indirilemedi.")
        print(f"Hata: {error}")
        return

    dictionary_words = process_dictionary(raw_dictionary)

    print(
        f"Ana sözlükteki 4-7 harfli kelime: "
        f"{len(dictionary_words)}"
    )

    save_words(dictionary_words, WORDS_FILE)

    print()
    print("words.txt oluşturuldu.")

    # -----------------------------------------
    # 2. YAYGIN HEDEF KELİMELER
    # -----------------------------------------

    target_words = create_target_words(
        dictionary_words
    )

    if not target_words:
        print()
        print("Yaygın kelime bulunamadı.")
        return

    save_words(
        target_words,
        TARGET_WORDS_FILE
    )

    print_statistics(
        target_words,
        "HEDEF KELİME HAVUZU"
    )

    # -----------------------------------------
    # 3. SONUÇ
    # -----------------------------------------

    print()
    print("========================================")
    print("VERİ SETİ HAZIR")
    print("========================================")

    print(f"words.txt:")
    print(f"  {len(dictionary_words)} kelime")

    print()
    print("target_words.txt:")
    print(f"  {len(target_words)} yaygın kelime")

    print()
    print("Dosyalar:")
    print(f"  {WORDS_FILE}")
    print(f"  {TARGET_WORDS_FILE}")

    print()
    print("Bir sonraki adım:")
    print("python seed.py")
    print()


if __name__ == "__main__":
    main()