"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type LetterStatus = "correct" | "present" | "absent";

type LetterResult = {
  letter: string;
  status: LetterStatus;
};

type GameResponse = {
  game_id: string;
  stage: number;
  total_stages: number;
  length: number;
  max_attempts: number;
  first_letter: string | null;
  score: number;
  status: string;
  time_limit: number;
  remaining_seconds: number;
};

type GuessResponse = {
  success: boolean;
  correct?: boolean;
  finished?: boolean;
  message?: string;
  result?: LetterResult[];
  word?: string;
  attempts_used?: number;
  score_gained?: number;
  game?: GameResponse;
};

type ErrorResponse = {
  error: string;
};

const API = "http://127.0.0.1:8000";

const STAGE_LENGTHS = [4, 4, 5, 5, 6, 6, 7];
const STAGE_ATTEMPTS = [6, 6, 5, 5, 5, 4, 6];

const keyboardRows = [
  "QWERTYUIOPĞÜ".split(""),
  "ASDFGHJKLŞİ".split(""),
  "ZXCVBNMÖÇI".split(""),
];

function upperTR(value: string) {
  return value.toLocaleUpperCase("tr-TR");
}

function isError(data: unknown): data is ErrorResponse {
  return (
    !!data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as ErrorResponse).error === "string"
  );
}

function statusClass(status: LetterStatus) {
  if (status === "correct") {
    return `
      border-purple-300
      bg-purple-500/75
      text-white
      shadow-[0_0_22px_rgba(168,85,247,0.75)]
    `;
  }

  if (status === "present") {
    return `
      border-cyan-300
      bg-cyan-500/65
      text-white
      shadow-[0_0_22px_rgba(56,189,248,0.65)]
    `;
  }

  return `
    border-slate-500/40
    bg-slate-700/45
    text-slate-300
  `;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `00:${safe.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [game, setGame] = useState<GameResponse | null>(null);
  const [guesses, setGuesses] = useState<GuessResponse[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [remaining, setRemaining] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stageCompleted, setStageCompleted] = useState(false);
  const [competitionFinished, setCompetitionFinished] = useState(false);
  const [lost, setLost] = useState(false);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutSent = useRef(false);

  const wordLength = game?.length ?? 4;
  const maxAttempts = game?.max_attempts ?? 6;
  const stage = game?.stage ?? 1;
  const firstLetter = game?.first_letter ?? null;

  const stageProgress = useMemo(
    () => `${((stage - 1) / 7) * 100}%`,
    [stage]
  );

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const applyGame = useCallback((data: GameResponse) => {
    setGame(data);
    setRemaining(data.remaining_seconds);
    setCurrentGuess("");
    setGuesses([]);
    setStageCompleted(false);
    setCompetitionFinished(false);
    setLost(false);
    setRevealedWord(null);
    setTimedOut(false);
    timeoutSent.current = false;
  }, []);

  async function startGame() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API}/api/game/new`, {
        method: "POST",
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        if (isError(data)) {
          throw new Error(data.error);
        }

        throw new Error("Oyun başlatılamadı.");
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        !("game" in data)
      ) {
        throw new Error("Sunucudan beklenmeyen cevap geldi.");
      }

      const responseData = data as {
        success: boolean;
        message?: string;
        game?: GameResponse;
      };

      if (!responseData.success || !responseData.game) {
        throw new Error(
          responseData.message ?? "Oyun başlatılamadı."
        );
      }

      applyGame(responseData.game);
      focusInput();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sunucuya bağlanılamadı."
      );
    } finally {
      setLoading(false);
    }
  }

  const endByTimeout = useCallback(async () => {
    if (
      !game?.game_id ||
      timeoutSent.current ||
      stageCompleted ||
      competitionFinished
    ) {
      return;
    }

    timeoutSent.current = true;

    try {
      const response = await fetch(
        `${API}/api/game/timeout/${game.game_id}`,
        {
          method: "POST",
        }
      );

      const data: unknown = await response.json();

      if (isError(data)) {
        throw new Error(data.error);
      }

      const result = data as GuessResponse;

      setRemaining(0);
      setLost(true);
      setTimedOut(true);
      setCompetitionFinished(true);
      setRevealedWord(result.word ?? null);
    } catch {
      setError(
        "Süre doldu fakat sonuç alınamadı. Lütfen yeniden başlat."
      );
    }
  }, [
    game?.game_id,
    stageCompleted,
    competitionFinished,
  ]);

  useEffect(() => {
    if (!game || stageCompleted || competitionFinished) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    game?.game_id,
    stageCompleted,
    competitionFinished,
  ]);

  useEffect(() => {
    if (
      remaining === 0 &&
      game &&
      !stageCompleted &&
      !competitionFinished
    ) {
      void endByTimeout();
    }
  }, [
    remaining,
    game,
    stageCompleted,
    competitionFinished,
    endByTimeout,
  ]);

  useEffect(() => {
    if (
      game &&
      !stageCompleted &&
      !competitionFinished
    ) {
      focusInput();
    }
  }, [
    game?.game_id,
    stage,
    stageCompleted,
    competitionFinished,
    focusInput,
  ]);

  async function submitGuess() {
    if (
      !game ||
      loading ||
      stageCompleted ||
      competitionFinished
    ) {
      return;
    }

    const guess = upperTR(currentGuess.trim());

    setError(null);

    if (guess.length !== wordLength) {
      setError(
        `Lütfen ${wordLength} harfin tamamını yaz.`
      );
      focusInput();
      return;
    }

    if (
      firstLetter &&
      !guess.startsWith(firstLetter)
    ) {
      setError(
        `Kelime ${firstLetter} harfi ile başlamalı.`
      );
      focusInput();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/game/guess`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            game_id: game.game_id,
            guess,
          }),
        }
      );

      const data: unknown = await response.json();

      if (!response.ok) {
        if (isError(data)) {
          throw new Error(data.error);
        }

        throw new Error(
          "Tahmin gönderilemedi."
        );
      }

      const result = data as GuessResponse;

      if (!result.success) {
        setError(
          result.message ??
            "Tahmin kabul edilmedi."
        );

        focusInput();
        return;
      }

      if (Array.isArray(result.result)) {
        setGuesses((previous) => [
          ...previous,
          {
            ...result,
            result: result.result,
          },
        ]);
      }

      if (result.game) {
        setGame(result.game);
        setRemaining(
          result.game.remaining_seconds
        );
      }

      setCurrentGuess("");

      if (result.correct) {
        setRevealedWord(
          result.word ?? null
        );

        if (result.finished) {
          setCompetitionFinished(true);
        } else {
          setStageCompleted(true);
        }
      } else if (result.finished) {
        setLost(true);
        setCompetitionFinished(true);
        setRevealedWord(
          result.word ?? null
        );
      } else {
        focusInput();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tahmin gönderilemedi."
      );

      focusInput();
    } finally {
      setLoading(false);
    }
  }

  async function nextStage() {
    if (!game) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API}/api/game/next/${game.game_id}`,
        {
          method: "POST",
        }
      );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        if (isError(data)) {
          throw new Error(data.error);
        }

        throw new Error(
          "Sonraki etaba geçilemedi."
        );
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("success" in data) ||
        !("game" in data)
      ) {
        throw new Error(
          "Sonraki etap bilgisi alınamadı."
        );
      }

      const responseData = data as {
        success: boolean;
        message?: string;
        game?: GameResponse;
      };

      if (
        !responseData.success ||
        !responseData.game
      ) {
        throw new Error(
          responseData.message ??
            "Sonraki etaba geçilemedi."
        );
      }

      applyGame(responseData.game);
      focusInput();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sonraki etaba geçilemedi."
      );
    } finally {
      setLoading(false);
    }
  }

  function restartGame() {
    setGame(null);
    setGuesses([]);
    setCurrentGuess("");
    setError(null);
    setStageCompleted(false);
    setCompetitionFinished(false);
    setLost(false);
    setRevealedWord(null);
    setTimedOut(false);
    timeoutSent.current = false;
  }

  function addLetter(letter: string) {
    if (
      loading ||
      stageCompleted ||
      competitionFinished
    ) {
      return;
    }

    if (currentGuess.length >= wordLength) {
      return;
    }

    setCurrentGuess(
      (previous) => previous + letter
    );

    setError(null);
    focusInput();
  }

  function removeLetter() {
    if (
      loading ||
      stageCompleted ||
      competitionFinished
    ) {
      return;
    }

    setCurrentGuess(
      (previous) => previous.slice(0, -1)
    );

    setError(null);
    focusInput();
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitGuess();
    }
  }

  const keyboardStatus = useMemo(() => {
    const map = new Map<
      string,
      LetterStatus
    >();

    for (const guess of guesses) {
      for (const item of guess.result ?? []) {
        const previous = map.get(
          item.letter
        );

        if (
          item.status === "correct" ||
          (
            item.status === "present" &&
            previous !== "correct"
          )
        ) {
          map.set(
            item.letter,
            item.status
          );
        } else if (!previous) {
          map.set(
            item.letter,
            item.status
          );
        }
      }
    }

    return map;
  }, [guesses]);

  return (
    <main className="min-h-screen bg-transparent text-white px-4 py-5 md:px-8 md:py-8 relative overflow-hidden">
      <div className="pointer-events-none absolute left-[5%] top-[12%] h-72 w-72 rounded-full bg-purple-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-[5%] top-[25%] h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />
      <div className="pointer-events-none absolute left-[40%] bottom-[-100px] h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl relative z-10">

        {/* BAŞLIK */}

        <header className="relative mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between border-b border-purple-400/20 pb-6">

          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-purple-300/70 mb-2">
              ✦ CANLI OYUN PROGRAMI
            </p>

            <h1
              className="
                text-5xl md:text-7xl
                font-black
                tracking-[-0.06em]
                bg-gradient-to-r
                from-white
                via-purple-200
                to-cyan-300
                bg-clip-text
                text-transparent
                drop-shadow-[0_0_25px_rgba(168,85,247,0.45)]
              "
            >
              HARF 7
            </h1>

            <p className="mt-2 text-xs tracking-[0.3em] uppercase text-white/30">
              EN İYİ KELİME MEYDAN OKUMASI
            </p>
          </div>

          {game && (
            <div className="flex items-center gap-3">

              <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 px-5 py-3 backdrop-blur-md">
                <p className="text-[9px] uppercase tracking-[0.25em] text-purple-300/60">
                  ETAP
                </p>

                <p className="text-3xl font-black text-purple-100">
                  {stage}
                  <span className="text-purple-400/40">
                    /7
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 backdrop-blur-md">
                <p className="text-[9px] uppercase tracking-[0.25em] text-cyan-300/60">
                  PUAN
                </p>

                <p className="text-3xl font-black text-cyan-100">
                  {game.score}
                </p>
              </div>

            </div>
          )}
        </header>

        {/* BAŞLANGIÇ EKRANI */}

        {!game && !competitionFinished && (
          <section
            className="
              grid
              md:grid-cols-[1.3fr_.7fr]
              gap-0
              rounded-[2rem]
              overflow-hidden
              border
              border-purple-400/20
              bg-[#0d0924]/90
              shadow-[0_0_80px_rgba(168,85,247,0.12)]
              backdrop-blur-xl
            "
          >

            <div className="relative p-8 md:p-14 border-b md:border-b-0 md:border-r border-purple-400/15">

              <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-purple-400/10 shadow-[0_0_40px_rgba(168,85,247,0.15)]" />

              <p className="text-sm uppercase tracking-[0.3em] text-purple-300/60 mb-5">
                7 ETAP · 60 SANİYE
              </p>

              <h2
                className="
                  text-5xl
                  md:text-7xl
                  font-black
                  tracking-[-0.06em]
                  leading-[0.9]
                  mb-8
                  bg-gradient-to-r
                  from-white
                  via-purple-200
                  to-cyan-300
                  bg-clip-text
                  text-transparent
                "
              >
                Kelimeyi
                <br />
                bul.
              </h2>

              <p className="max-w-md text-purple-100/55 leading-7 mb-8">
                İlk altı etapta ilk harf verilir.
                Kelimenin tamamını bul ve doğru
                tahminlerle puanını yükselt.
                Finalde yedi harfin tamamı senden.
              </p>

              <button
                onClick={startGame}
                disabled={loading}
                className="
                  rounded-full
                  bg-gradient-to-r
                  from-purple-600
                  via-fuchsia-500
                  to-cyan-500
                  text-white
                  px-8
                  py-4
                  font-black
                  tracking-wide
                  shadow-[0_0_25px_rgba(168,85,247,0.4)]
                  hover:scale-[1.03]
                  hover:shadow-[0_0_40px_rgba(168,85,247,0.65)]
                  transition
                  disabled:opacity-50
                "
              >
                {loading
                  ? "HAZIRLANIYOR..."
                  : "YARIŞMAYI BAŞLAT"}
              </button>

              {error && (
                <p className="mt-5 text-fuchsia-300 font-semibold">
                  {error}
                </p>
              )}
            </div>

            <div className="p-8 md:p-10 bg-[#100b2b]">

              <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/50 mb-5">
                ETAP PLANI
              </p>

              <div className="space-y-3">
                {STAGE_LENGTHS.map(
                  (length, index) => (
                    <div
                      key={index}
                      className="
                        flex
                        items-center
                        justify-between
                        border-b
                        border-purple-300/10
                        pb-3
                      "
                    >
                      <span className="font-black text-purple-200">
                        0{index + 1}
                      </span>

                      <span className="font-semibold text-white/80">
                        {index === 6
                          ? "FINAL"
                          : `${length} HARF`}
                      </span>

                      <span className="text-purple-200/40 text-sm">
                        {STAGE_ATTEMPTS[index]} HAK
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="mt-8 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />

              <div className="mt-6 flex gap-3 text-xs text-white/35">
                <span>● MOR</span>
                <span>● MAVİ</span>
                <span>● NEON</span>
              </div>
            </div>
          </section>
        )}

        {/* OYUN */}

        {game && !competitionFinished && (
          <section>

            {/* İLERLEMEK */}

            <div className="mb-5">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="
                    h-full
                    bg-gradient-to-r
                    from-purple-500
                    via-fuchsia-400
                    to-cyan-400
                    shadow-[0_0_15px_rgba(168,85,247,0.6)]
                    transition-all
                    duration-500
                  "
                  style={{
                    width: stageProgress,
                  }}
                />
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_290px] gap-6 items-start">

              {/* PANO */}

              <div>

                <div
                  className="
                    border
                    border-purple-400/20
                    rounded-[2rem]
                    bg-[#0d0924]/90
                    p-5
                    md:p-8
                    shadow-[0_0_60px_rgba(168,85,247,0.08)]
                    backdrop-blur-xl
                  "
                >

                  <div className="flex flex-wrap items-center justify-between gap-4 mb-7">

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/50 mb-1">
                        ETAP {stage}
                      </p>

                      <h2 className="text-2xl md:text-3xl font-black text-white">
                        {wordLength} HARFLİ KELİME
                      </h2>

                      <p className="text-xs text-white/25 mt-1 tracking-widest uppercase">
                        KELİMEYİ BUL
                      </p>
                    </div>

                    <div
                      className={`
                        rounded-2xl
                        px-6
                        py-3
                        font-black
                        text-xl
                        tabular-nums
                        border
                        transition-all
                        ${
                          remaining <= 10
                            ? `
                              border-fuchsia-400
                              bg-fuchsia-500/20
                              text-fuchsia-200
                              shadow-[0_0_30px_rgba(232,121,249,0.6)]
                              animate-pulse
                            `
                            : `
                              border-cyan-400/30
                              bg-cyan-500/10
                              text-cyan-200
                              shadow-[0_0_20px_rgba(56,189,248,0.2)]
                            `
                        }
                      `}
                    >
                      {formatTime(remaining)}
                    </div>

                  </div>

                  {/* KAROLAR */}

                  <div className="flex flex-col gap-2">

                    {Array.from({
                      length: maxAttempts,
                    }).map(
                      (_, rowIndex) => {
                        const completed =
                          guesses[rowIndex];

                        const active =
                          rowIndex ===
                          guesses.length;

                        return (
                          <div
                            key={rowIndex}
                            className={`
                              flex
                              justify-center
                              gap-1.5
                              md:gap-2
                              p-1.5
                              rounded-xl
                              transition-all
                              ${
                                active &&
                                !stageCompleted
                                  ? "bg-purple-500/[0.035]"
                                  : ""
                              }
                            `}
                          >
                            {Array.from({
                              length: wordLength,
                            }).map(
                              (_, colIndex) => {

                                const item =
                                  completed
                                    ?.result?.[
                                      colIndex
                                    ];

                              const displayLetter =
                                 item?.letter ??
                                 (active && colIndex === 0 && firstLetter
                                 ? firstLetter
                                 : "");

                                const tileClass =
                                  item
                                    ? statusClass(
                                        item.status
                                      )
                                    : displayLetter
                                      ? `
                                        border-purple-400/60
                                        bg-purple-500/10
                                        text-white
                                        shadow-[0_0_18px_rgba(168,85,247,0.3)]
                                      `
                                      : `
                                        border-purple-400/10
                                        bg-white/[0.025]
                                        text-white/20
                                      `;

                                return (
                                  <div
                                    key={
                                      colIndex
                                    }
                                    className={`
                                      w-12
                                      h-12
                                      sm:w-14
                                      sm:h-14
                                      md:w-16
                                      md:h-16
                                      rounded-xl
                                      border-2
                                      flex
                                      items-center
                                      justify-center
                                      text-xl
                                      md:text-2xl
                                      font-black
                                      transition-all
                                      duration-300
                                      ${tileClass}
                                    `}
                                  >
                                    {displayLetter}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        );
                      }
                    )}

                  </div>

                  {/* GİRİŞ */}

                  <div className="mt-7 border-t border-purple-300/10 pt-6">

                    <p className="text-[10px] uppercase tracking-[0.25em] text-purple-300/50 mb-3">
                      TAHMİNİN
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">

                      <input
                        ref={inputRef}
                        value={currentGuess}
                        onChange={(event) => {
                          const value =
                            upperTR(
                              event.target.value
                            ).replace(
                              /[^A-ZÇĞİÖŞÜ]/g,
                              ""
                            );

                          setCurrentGuess(
                            value.slice(
                              0,
                              wordLength
                            )
                          );

                          setError(null);
                        }}
                        onKeyDown={
                          handleKeyDown
                        }
                        disabled={
                          loading ||
                          stageCompleted ||
                          competitionFinished
                        }
                        maxLength={
                          wordLength
                        }
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder={`${wordLength} harfin tamamını yaz...`}
                        className="
                          min-w-0
                          flex-1
                          rounded-2xl
                          border
                          border-purple-400/30
                          bg-purple-500/[0.06]
                          px-5
                          py-4
                          text-xl
                          font-black
                          uppercase
                          text-white
                          placeholder:text-purple-200/20
                          outline-none
                          focus:border-purple-400
                          focus:shadow-[0_0_30px_rgba(168,85,247,0.2)]
                          disabled:opacity-50
                        "
                      />

                      <button
                        onClick={() =>
                          void submitGuess()
                        }
                        disabled={
                          loading ||
                          !currentGuess ||
                          stageCompleted ||
                          competitionFinished
                        }
                        className="
                          rounded-2xl
                          bg-gradient-to-r
                          from-purple-600
                          to-cyan-500
                          text-white
                          px-7
                          py-4
                          font-black
                          shadow-[0_0_20px_rgba(168,85,247,0.3)]
                          hover:translate-y-[-2px]
                          hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]
                          disabled:opacity-30
                          transition
                        "
                      >
                        TAHMİN ET
                      </button>

                    </div>

                    {error && (
                      <p className="mt-3 text-fuchsia-300 font-semibold">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* KLAVYE */}

              <aside
                className="
                  border
                  border-cyan-400/15
                  rounded-[2rem]
                  bg-[#09071c]/95
                  text-white
                  p-5
                  md:p-6
                  shadow-[0_0_50px_rgba(56,189,248,0.08)]
                  backdrop-blur-xl
                "
              >

                <div className="flex justify-between items-end mb-5">

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/40">
                      KALAN HAK
                    </p>

                    <p className="text-4xl font-black text-white">
                      {Math.max(
                        0,
                        maxAttempts -
                          guesses.length
                      )}
                    </p>
                  </div>

                  <div className="text-right">

                    <p className="text-[10px] uppercase tracking-[0.25em] text-purple-300/40">
                      KELİME
                    </p>

                    <p className="text-xl font-black text-purple-200">
                      {firstLetter
                        ? `${firstLetter}${"•".repeat(
                            Math.max(
                              0,
                              wordLength - 1
                            )
                          )}`
                        : "•".repeat(
                            wordLength
                          )}
                    </p>

                  </div>
                </div>

                {/* KLAVYE */}

                <div className="space-y-2">

                  {keyboardRows.map(
                    (row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="flex justify-center gap-1"
                      >
                        {row.map(
                          (letter) => {
                            const status =
                              keyboardStatus.get(
                                letter
                              );

                            return (
                              <button
                                key={letter}
                                onClick={() =>
                                  addLetter(
                                    letter
                                  )
                                }
                                disabled={
                                  loading ||
                                  stageCompleted ||
                                  competitionFinished
                                }
                                className={`
                                  w-7
                                  h-10
                                  sm:w-9
                                  sm:h-11
                                  rounded-lg
                                  border
                                  font-black
                                  text-xs
                                  transition-all
                                  duration-200
                                  disabled:opacity-25

                                  ${
                                    status ===
                                    "correct"
                                      ? `
                                        border-purple-300
                                        bg-purple-500/70
                                        shadow-[0_0_15px_rgba(168,85,247,0.65)]
                                      `
                                      : status ===
                                          "present"
                                        ? `
                                          border-cyan-300
                                          bg-cyan-500/60
                                          shadow-[0_0_15px_rgba(56,189,248,0.55)]
                                        `
                                        : status ===
                                            "absent"
                                          ? `
                                            border-white/5
                                            bg-white/5
                                            text-white/25
                                          `
                                          : `
                                            border-purple-300/10
                                            bg-purple-500/5
                                            text-white
                                            hover:border-purple-300/40
                                            hover:bg-purple-500/15
                                            hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]
                                          `
                                  }
                                `}
                              >
                                {letter}
                              </button>
                            );
                          }
                        )}
                      </div>
                    )
                  )}

                  <div className="flex justify-center pt-1">

                    <button
                      onClick={
                        removeLetter
                      }
                      disabled={
                        loading ||
                        stageCompleted ||
                        competitionFinished ||
                        !currentGuess
                      }
                      className="
                        w-full
                        max-w-[220px]
                        h-11
                        rounded-lg
                        border
                        border-fuchsia-400/30
                        bg-fuchsia-500/10
                        text-fuchsia-100
                        font-black
                        hover:bg-fuchsia-500/20
                        hover:shadow-[0_0_20px_rgba(232,121,249,0.25)]
                        disabled:opacity-25
                        transition
                      "
                    >
                      ⌫ &nbsp; SİL
                    </button>

                  </div>
                </div>

                {/* EFSANE */}

                <div className="border-t border-white/10 mt-6 pt-5 space-y-2 text-xs text-white/50">

                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                    Doğru harf / doğru yer
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                    Doğru harf / yanlış yer
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-slate-600" />
                    Kelimede yok
                  </div>

                </div>
              </aside>
            </div>
          </section>
        )}

        {/* AŞAMA TAMAMLANDI*/}

        {stageCompleted && !competitionFinished && (
          <section
            className="
              mt-6
              rounded-[2rem]
              border
              border-purple-400/30
              bg-[#0d0924]/95
              text-white
              p-8
              md:p-12
              text-center
              shadow-[0_0_80px_rgba(168,85,247,0.2)]
            "
          >

            <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/50 mb-3">
              ✦ ETAP TAMAMLANDI ✦
            </p>

            <h2
              className="
                text-5xl
                md:text-7xl
                font-black
                tracking-[-0.05em]
                mb-4
                bg-gradient-to-r
                from-purple-300
                via-fuchsia-300
                to-cyan-300
                bg-clip-text
                text-transparent
                drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]
              "
            >
              DOĞRU!
            </h2>

            {revealedWord && (
              <p className="text-white/50 mb-7">
                Kelime:{" "}
                <strong className="text-purple-200">
                  {revealedWord}
                </strong>
              </p>
            )}

            <p className="text-white/40 mb-7">
              Güncel puanın:{" "}
              <strong className="text-cyan-300">
                {game?.score}
              </strong>
            </p>

            <button
              onClick={() =>
                void nextStage()
              }
              disabled={loading}
              className="
                rounded-full
                bg-gradient-to-r
                from-purple-600
                to-cyan-500
                text-white
                px-8
                py-4
                font-black
                shadow-[0_0_30px_rgba(168,85,247,0.4)]
                hover:scale-[1.04]
                transition
                disabled:opacity-50
              "
            >
              {loading
                ? "HAZIRLANIYOR..."
                : `ETAP ${stage + 1}'E GEÇ`}
            </button>

          </section>
        )}

        {/* FINAL */}

        {competitionFinished && (
          <section
            className="
              relative
              overflow-hidden
              rounded-[2rem]
              border
              border-purple-400/30
              bg-[#09071c]/95
              text-white
              p-8
              md:p-16
              text-center
              shadow-[0_0_100px_rgba(168,85,247,0.25)]
            "
          >

            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-purple-600/15 blur-[80px]" />
            <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-cyan-500/15 blur-[80px]" />

            <div className="relative z-10">

              <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/50 mb-4">
                ✦ YARIŞMA SONA ERDİ ✦
              </p>

              <h2
                className="
                  text-6xl
                  md:text-8xl
                  font-black
                  tracking-[-0.06em]
                  mb-5
                  bg-gradient-to-r
                  from-purple-300
                  via-fuchsia-300
                  to-cyan-300
                  bg-clip-text
                  text-transparent
                  drop-shadow-[0_0_35px_rgba(168,85,247,0.5)]
                "
              >
                {lost
                  ? "OLMADI."
                  : "ŞAMPİYON!"}
              </h2>

              {revealedWord && (
                <p className="text-white/50 mb-2">
                  Doğru kelime:{" "}
                  <strong className="text-purple-200">
                    {revealedWord}
                  </strong>
                </p>
              )}

              {timedOut && (
                <p className="text-fuchsia-300 mb-2">
                  Süre doldu.
                </p>
              )}

              <p className="text-2xl font-black mb-8 text-cyan-200">
                Toplam puan:{" "}
                {game?.score ?? 0}
              </p>

              <button
                onClick={restartGame}
                className="
                  rounded-full
                  bg-gradient-to-r
                  from-purple-600
                  to-cyan-500
                  text-white
                  px-8
                  py-4
                  font-black
                  shadow-[0_0_30px_rgba(168,85,247,0.4)]
                  hover:scale-[1.04]
                  transition
                "
              >
                YENİDEN OYNA
              </button>

            </div>
          </section>
        )}

      </div>
    </main>
  );
}
