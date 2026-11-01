# DAYTONAA

### Learn. Experiment. Analyse. Build.

DAYTONAA is a personal data science learning workspace: a structured path from Python and statistics fundamentals through machine learning and portfolio projects. It brings lessons, study resources, practice, notes, and progress tracking together in one responsive app.

Built with plain **HTML, CSS, and JavaScript**. There is no Node.js, package manager, database, application API, or account setup.

## Features

- **Six-level learning roadmap** with 68 topics, from foundations to industry projects.
- **Learning dashboard** with locally calculated progress, study streaks, activity, and continue-learning cards.
- **Video lessons and digital library** with selected learning links, resource search, and bookmarks.
- **Assignments, guided projects, and quizzes** for hands-on practice.
- **Coding Lab** for writing and saving code snippets in the browser.
- **Personal study assistant** with bundled explainers; it does not use a generative AI service.
- **Notes, study planner, and analytics** that reflect activity saved in your browser.
- **Responsive dark and light themes**, mobile navigation, and reduced-motion support.

## Run DAYTONAA

No dependencies or build step are required. You need Python 3 only to serve the files over your local network.

```sh
git clone https://github.com/<your-username>/daytonaa-data-science.git
cd daytonaa-data-science
sh run-ip.sh
```

The server listens on port `8000` and binds to `0.0.0.0`, so other devices on the same Wi-Fi network can connect. Open the LAN address printed by the script. If no address is printed, find this computer's local IP and visit:

```text
http://<your-lan-ip>:8000
```

Keep the terminal open while using the app. Press `Ctrl+C` to stop the server. You can choose another port with `PORT=8080 sh run-ip.sh`.

To preview on only your own computer, you can also run `python3 -m http.server 8000` and open `http://localhost:8000`.

## How data works

DAYTONAA stores personal activity in the browser's `localStorage`. Progress, bookmarks, lesson completion, assignment drafts, project reflections, quiz attempts, notes, study tasks, sessions, and preferences are kept on that browser and device. There are no accounts, cloud backups, or cross-device syncing. Clearing the browser's site data removes this saved activity.

The app makes no application API calls and needs no API keys. External video embeds and educational resource links open their publishers and need an internet connection.

## Current scope

- The Coding Lab saves code as text; it does not execute Python or SQL.
- Assignment and project responses are personal drafts; they are not automatically graded.
- The study assistant uses bundled explanations and is not an AI tutor.
- Resource links go to original publishers. DAYTONAA does not redistribute copyrighted books.
- `run-ip.sh` is intended for local network previews, not as a production web server.

## Project structure

```text
daytonaa/
├── index.html
├── run-ip.sh
├── README.md
├── docs/
│   └── architecture.md
└── static/
    └── daytonaa/
        ├── app.js
        ├── app.css
        ├── vanilla.css
        ├── catalog.js
        └── icon.svg
```

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- Browser `localStorage`
- Python's built-in static file server (for LAN preview only)

## License

No license has been added yet. Add a license before allowing others to reuse, modify, or redistribute this project.
