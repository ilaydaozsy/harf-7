# HARF 7

A Turkish word puzzle game inspired by classic word-guessing games, featuring a progressive 7-stage gameplay system, timed rounds, Turkish alphabet support, and a standalone Windows application.

## Overview

HARF 7 is a full-stack Turkish word game developed with a **Next.js frontend** and **FastAPI backend**.

The game consists of seven progressively challenging stages. Players must discover the hidden Turkish word within a limited number of attempts and complete each stage before the timer runs out.

The project was developed as a complete desktop-distributable application rather than only a browser-based prototype.

## Features

* 7 progressive game stages
* Turkish word dictionary
* Turkish alphabet and keyboard support
* Different word lengths across stages
* Stage-specific attempt limits
* 60-second timer for each stage
* First-letter hints in the first six stages
* Final 7-letter challenge without a first-letter hint
* Letter feedback system:

  * Correct position
  * Correct letter, wrong position
  * Letter not included
* Invalid words do not consume an attempt
* Automatic stage progression
* Game scoring
* Responsive game interface
* SQLite word database
* Standalone Windows `.exe` distribution
* Automatic browser launch
* No Python, Node.js or npm installation required for the distributed version

## Game Structure

| Stage | Word Length | Attempts | Hint         |
| ----: | ----------: | -------: | ------------ |
|     1 |   4 letters |        6 | First letter |
|     2 |   4 letters |        6 | First letter |
|     3 |   5 letters |        5 | First letter |
|     4 |   5 letters |        5 | First letter |
|     5 |   6 letters |        5 | First letter |
|     6 |   6 letters |        5 | First letter |
|     7 |   7 letters |        6 | No hint      |

Each stage has a **60-second time limit**.

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Python
* FastAPI
* Uvicorn
* SQLAlchemy
* SQLite

### Distribution

* PyInstaller
* Windows executable (`HARF7.exe`)

## Architecture

```text
HARF 7
│
├── frontend
│   ├── Next.js
│   ├── React
│   ├── TypeScript
│   └── Tailwind CSS
│
└── backend
    ├── FastAPI
    ├── SQLAlchemy
    ├── SQLite
    ├── Game API
    └── PyInstaller Launcher
```

For the distributed Windows version, the Next.js application is exported as static files and served by the FastAPI application.

The Python application and frontend are bundled into a single executable using PyInstaller.

## API

The backend provides endpoints for the main game flow:

```text
POST /api/game/new
POST /api/game/guess
POST /api/game/next/{game_id}
POST /api/game/timeout/{game_id}
GET  /api/game/status/{game_id}
GET  /health
```

## Running the Development Version

### Backend

```bash
cd backend

python -m venv venv
```

Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the required packages and start the API:

```powershell
python -m uvicorn main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The development frontend runs at:

```text
http://localhost:3000
```

## Windows Distribution

The project can be packaged as a standalone Windows executable with PyInstaller.

```powershell
cd backend

pyinstaller --noconfirm --clean --onefile --noconsole --name HARF7 --add-data "..\frontend\out;frontend\out" --add-data "target_words.txt;." --add-data "kelime5.db;." launcher.py
```

The resulting executable is created in:

```text
backend/dist/HARF7.exe
```

The distributed application automatically starts the local game server and opens the game in the default browser.

Users do not need to install:

* Python
* Node.js
* npm
* FastAPI
* SQLAlchemy
* Uvicorn

## Project Structure

```text
harf-7/
│
├── backend/
│   ├── app/
│   │   ├── database/
│   │   ├── models/
│   │   └── routers/
│   ├── launcher.py
│   ├── main.py
│   ├── import_words.py
│   ├── seed.py
│   ├── target_words.txt
│   ├── words.txt
│   └── kelime5.db
│
├── frontend/
│   ├── app/
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

## Development

HARF 7 was developed as a full-stack application with a focus on:

* REST API development
* Frontend/backend integration
* Database-driven word validation
* Turkish language support
* Game-state management
* Timed gameplay
* Desktop application packaging
* Windows distribution

## License

This project is intended as a personal portfolio project.
