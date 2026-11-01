(() => {
  "use strict";

  const CATALOG = window.DAYTONAA_CATALOG;
  const STORAGE_KEY = "daytonaa.workspace.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const todayISO = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const defaultState = () => ({
    displayName: "Learner", goalMinutes: 45, theme: "dark", completedTopics: [], bookmarks: [],
    watchedVideos: [], videoHistory: [], sessions: [], tasks: [], notes: [], drafts: {},
    projectSubmissions: {}, quizBest: 0, quizAttempts: [], tutorMessages: [], codeDraft: "# Your Python practice starts here\n",
  });
  let state = loadState();
  let activeNote = "";
  let activeAssignment = "";
  let activeProject = "";
  let activeVideo = state.videoHistory[0] || CATALOG.videoLessons[0]?.id || "";
  let searchQuery = "";
  let toastTimer;
  let noteAutosaveTimer;
  let preserveSearchOnRoute = false;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  }

  function saveState(message = "Saved in this browser") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) toast(message);
    } catch {
      toast("Browser storage is full. Export or remove some notes.");
    }
    updateProfile();
  }

  function toast(message) {
    const region = $("#toast-region");
    if (!region) return;
    region.innerHTML = `<div class="toast-card"><span>✦</span>${escapeHTML(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { region.innerHTML = ""; }, 2500);
  }

  function makeId() {
    return `dtn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function slug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function getTopics() {
    return CATALOG.levels.flatMap((level) => level.modules.flatMap((module) => module.topics.map((title) => ({
      id: `l${level.number}:${slug(module.title)}:${slug(title)}`,
      title, module: module.title, level: level.number, levelTitle: level.title,
      levelColor: level.color, bookmarkKey: `topic:l${level.number}:${slug(module.title)}:${slug(title)}`,
    }))));
  }

  const topics = getTopics();
  const sectionTitles = Object.fromEntries(CATALOG.navigation.map((item) => [item.id, item.label]));
  const glyphs = {
    overview: "◫", learning: "▣", roadmap: "⌁", videos: "▷", library: "▤", assignments: "✓",
    "coding-lab": "⌘", projects: "◇", "quiz-centre": "◎", "ai-tutor": "✧", notes: "▱",
    analytics: "▥", "study-planner": "▦", settings: "⚙",
  };

  function currentSection() {
    const value = location.hash.replace(/^#/, "").split("?")[0];
    return sectionTitles[value] ? value : "overview";
  }

  function currentTopic() {
    return topics.find((topic) => !state.completedTopics.includes(topic.id)) || topics[0];
  }

  function minutesOn(date) {
    return state.sessions.filter((session) => session.date === date).reduce((sum, session) => sum + (Number(session.minutes) || 0), 0);
  }

  function minutesToday() { return minutesOn(todayISO()); }
  function totalMinutes() { return state.sessions.reduce((sum, session) => sum + (Number(session.minutes) || 0), 0); }

  function streakCount() {
    const days = new Set(state.sessions.map((session) => session.date));
    const cursor = new Date(`${todayISO()}T12:00:00`);
    if (!days.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function weekData() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${todayISO()}T12:00:00`);
      date.setDate(date.getDate() - (6 - index));
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { date: iso, label: date.toLocaleDateString(undefined, { weekday: "short" }), day: date.getDate(), minutes: minutesOn(iso) };
    });
  }

  function updateProfile() {
    const name = state.displayName?.trim() || "Learner";
    const initial = escapeHTML(name.slice(0, 1).toUpperCase());
    const sidebarName = $("#sidebar-name");
    const sidebarAvatar = $("#sidebar-avatar");
    const topAvatar = $("#top-avatar");
    const streak = $("#sidebar-streak");
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (topAvatar) topAvatar.textContent = initial;
    if (streak) streak.textContent = `${streakCount()} day streak`;
  }

  function renderNavigation(section) {
    const groups = ["Workspace", "Practice", "Personal"];
    $("#main-navigation").innerHTML = groups.map((group) => `
      <div class="nav-group"><div class="nav-label">${group}</div>
        ${CATALOG.navigation.filter((item) => item.group === group).map((item) => `
          <a class="nav-item${item.id === section ? " active" : ""}" href="#${item.id}" title="${escapeHTML(item.label)}">
            <span class="nav-glyph">${glyphs[item.id] || "·"}</span><span>${escapeHTML(item.label)}</span>${item.id === "ai-tutor" ? '<i class="nav-dot"></i>' : ""}
          </a>`).join("")}
      </div>`).join("");
  }

  function panelHeading(eyebrow, title, action = "") {
    return `<div class="panel-heading"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}<h2>${title}</h2></div>${action}</div>`;
  }

  function progressBar(value, total) {
    const percent = Math.min(100, Math.round((value / Math.max(1, total)) * 100));
    return `<div class="progress-track"><span style="width:${percent}%"></span></div>`;
  }

  function metric(symbol, color, label, value, suffix = "", note = "") {
    return `<article class="metric-card"><span class="metric-symbol ${color}">${symbol}</span><small>${label}</small><strong>${value}${suffix ? ` <em>${suffix}</em>` : ""}</strong>${note ? `<span class="metric-note">${note}</span>` : ""}</article>`;
  }

  function pageHeading(kicker, title, description, right = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${right}</div>`;
  }

  function button(label, action, extra = "") {
    return `<button class="button button-primary" type="button" data-action="${action}" ${extra}>${label}</button>`;
  }

  function renderOverview() {
    const topic = currentTopic();
    const weeks = weekData();
    const bars = weeks.map((day) => `<div class="week-bar-column"><div class="week-bar-track"><i style="height:${Math.min(100, Math.max(day.minutes ? 8 : 2, (day.minutes / 60) * 100))}%" title="${day.minutes} minutes"></i></div><small>${day.label}</small></div>`).join("");
    const tasks = state.tasks.filter((task) => task.date === todayISO()).slice(0, 4);
    const submitted = Object.values(state.drafts).filter((draft) => draft.submitted).length;
    return `
      <div class="hero-heading"><div><div class="eyebrow"><span class="live-dot"></span> YOUR LEARNING WORKSPACE</div><h1>Make today count, ${escapeHTML(state.displayName || "Learner")}.</h1><p>A clear next step makes a big path feel manageable.</p></div><a class="button button-primary" href="#roadmap">Continue the roadmap <span>→</span></a></div>
      <div class="metric-grid">
        ${metric("↗", "violet", "ROADMAP PROGRESS", state.completedTopics.length, `/ ${topics.length}`, "topics completed")}
        ${metric("◷", "cyan", "TODAY'S LEARNING", minutesToday(), "min", `${state.goalMinutes} minute daily goal`)}
        ${metric("✦", "orange", "STUDY STREAK", streakCount(), "days", "Based on recorded sessions")}
        ${metric("✓", "blue", "ASSIGNMENTS", submitted, "", "Saved submissions")}
      </div>
      <div class="overview-grid">
        <section class="panel continue-panel">${panelHeading("PICK UP WHERE YOU LEFT OFF", "Continue learning", `<span class="level-pill">LEVEL ${String(topic.level).padStart(2, "0")}</span>`)}
          <div class="continue-course"><span class="course-mark">${String(topic.level).padStart(2, "0")}</span><div><strong>${escapeHTML(topic.levelTitle)}</strong><small>${escapeHTML(topic.module)} · ${escapeHTML(topic.title)}</small></div></div>
          <div class="continue-progress"><span>${state.completedTopics.length} of ${topics.length} topics complete</span>${progressBar(state.completedTopics.length, topics.length)}</div><a class="button button-primary" href="#roadmap">Resume learning <span>→</span></a>
        </section>
        <section class="panel activity-panel">${panelHeading("YOUR LAST 7 DAYS", "Study activity", '<a class="text-link" href="#analytics">View analytics →</a>')}<div class="week-bars">${bars}</div><div class="chart-summary"><strong>${totalMinutes()} min</strong><span>total recorded learning time</span></div></section>
        <section class="panel tasks-panel">${panelHeading("YOUR NEXT STEPS", "Today's plan", '<a class="icon-button" href="#study-planner" aria-label="Open planner">＋</a>')}
          ${tasks.length ? `<div class="mini-task-list">${tasks.map((task) => `<div class="mini-task"><span class="task-check-static${task.done ? " done" : ""}">${task.done ? "✓" : ""}</span><span>${escapeHTML(task.title)}</span></div>`).join("")}</div>` : '<div class="empty-inline"><span>✦</span><strong>Your plan is open</strong><small>Add a small study task to get started.</small><a class="text-link" href="#study-planner">Open study planner →</a></div>'}
        </section>
        <section class="panel recommended-panel">${panelHeading("A GOOD NEXT STEP", "Suggested for you", '<span class="metric-symbol violet">✧</span>')}<p>Build a strong base with a short Python practice session, then record what you noticed in your notes.</p><div class="suggestion-links"><a href="#assignments">Explore your first dataset <span>→</span></a><a href="#notes">Capture a learning note <span>→</span></a></div></section>
      </div>`;
  }

  function renderLearning() {
    const topic = currentTopic();
    return `${pageHeading("YOUR PERSONAL CURRICULUM", "My Learning", "Follow the six levels at your pace. Your progress is saved in this browser.", '<a class="button button-primary" href="#roadmap">Open roadmap →</a>')}
      <div class="learning-overview panel"><span class="eyebrow">CURRENT FOCUS</span><h2>${escapeHTML(topic.title)}</h2><p>${escapeHTML(topic.module)} · ${escapeHTML(topic.levelTitle)}</p>${progressBar(state.completedTopics.length, topics.length)}<div class="learning-stats"><span>${state.completedTopics.length} topics complete</span><span>${state.notes.length} notes</span><span>${totalMinutes()} study minutes</span></div></div>
      <div class="level-card-grid">${CATALOG.levels.map((level) => `<a class="panel level-card" href="#roadmap" data-level-search="${escapeHTML(level.title)}"><span class="level-number">0${level.number}</span><span class="eyebrow">LEVEL 0${level.number}</span><h3>${escapeHTML(level.title)}</h3><p>${escapeHTML(level.subtitle)}</p><span class="text-link">Explore this level →</span></a>`).join("")}</div>`;
  }

  function renderRoadmap() {
    const query = searchQuery.trim().toLowerCase();
    const levels = CATALOG.levels.map((level) => {
      const modules = level.modules.map((module) => ({
        ...module,
        items: module.topics.map((title) => topics.find((topic) => topic.level === level.number && topic.module === module.title && topic.title === title))
          .filter((topic) => !query || `${topic.title} ${topic.module} ${level.title}`.toLowerCase().includes(query)),
      })).filter((module) => module.items.length);
      return { ...level, modules, count: level.modules.reduce((sum, module) => sum + module.topics.length, 0) };
    }).filter((level) => level.modules.length);
    const search = `<form class="search-field" data-form="search"><span>⌕</span><input name="query" value="${escapeHTML(searchQuery)}" placeholder="Find a topic…"><button class="icon-button" aria-label="Search">↵</button></form>`;
    return `${pageHeading("LEARNING ROADMAP", "The path to data science", "Six progressive levels. Follow the sequence or jump to a topic that interests you.", search)}
      <div class="roadmap-intro panel"><span class="metric-symbol violet">⌁</span><div><strong>Start with the foundations</strong><span>Each level builds on the skills before it. Your progress is saved as you go.</span></div><span class="roadmap-total">${state.completedTopics.length} topics completed</span></div>
      <div class="roadmap-list">${levels.length ? levels.map((level) => `<details class="panel roadmap-level level-${escapeHTML(level.color)}" open><summary class="roadmap-level-head"><span class="level-number">0${level.number}</span><span class="level-head-copy"><span class="eyebrow">LEVEL 0${level.number}</span><strong>${escapeHTML(level.title)}</strong><small>${escapeHTML(level.subtitle)}</small></span><span class="level-head-progress"><span>${level.modules.flatMap((module) => module.items).filter((topic) => state.completedTopics.includes(topic.id)).length}/${level.count} topics</span><i><b style="width:${Math.round(level.modules.flatMap((module) => module.items).filter((topic) => state.completedTopics.includes(topic.id)).length / Math.max(1, level.count) * 100)}%"></b></i></span><span class="summary-chevron">⌄</span></summary><div class="roadmap-content">${level.modules.map((module) => `<div class="roadmap-module"><div class="module-heading"><span class="module-mark">▤</span><strong>${escapeHTML(module.title)}</strong><span>${module.items.length} topics</span></div><div class="topic-list">${module.items.map((topic, index) => {
        const done = state.completedTopics.includes(topic.id);
        const saved = state.bookmarks.includes(topic.bookmarkKey);
        return `<div class="topic-entry"><div class="roadmap-topic${done ? " is-complete" : ""}"><button class="topic-check${done ? " checked" : ""}" data-action="toggle-topic" data-id="${escapeHTML(topic.id)}" aria-label="Toggle ${escapeHTML(topic.title)}">${done ? "✓" : ""}</button><span class="topic-index">${String(index + 1).padStart(2, "0")}</span><span class="topic-name">${escapeHTML(topic.title)}</span><span class="topic-duration">◷ 30 min</span><button class="icon-button bookmark-button${saved ? " saved" : ""}" data-action="bookmark" data-id="${escapeHTML(topic.bookmarkKey)}" aria-label="Bookmark ${escapeHTML(topic.title)}">◇</button></div><div class="topic-detail"><div><span class="eyebrow">LEARNING OBJECTIVES</span><p>Explain the key ideas in <strong>${escapeHTML(topic.title)}</strong> and apply them in a small example.</p><small>Estimated time: 30 minutes · Build on the previous topic in this module.</small></div><div class="topic-detail-actions"><a href="#videos">▷ <span><strong>Find a lesson video</strong><small>Browse trusted educator channels</small></span></a><a href="#assignments">✓ <span><strong>Practice assignment</strong><small>Apply the concept</small></span></a><a href="#quiz-centre">◎ <span><strong>Knowledge check</strong><small>Try a short quiz</small></span></a><a href="#notes">▱ <span><strong>Open your notes</strong><small>Capture what you learned</small></span></a></div></div></div>`;
      }).join("")}</div></div>`).join("")}</div></details>`).join("") : '<div class="empty-state panel">No topics match that search. Try a broader search.</div>'}</div>`;
  }

  function renderVideos() {
    const query = searchQuery.toLowerCase().trim();
    const videos = CATALOG.videoLessons.filter((video) => !query || `${video.title} ${video.topic} ${video.provider}`.toLowerCase().includes(query));
    const selected = videos.find((video) => video.id === activeVideo) || videos[0];
    if (selected) {
      activeVideo = selected.id;
      state.videoHistory = [selected.id, ...state.videoHistory.filter((id) => id !== selected.id)].slice(0, 12);
      saveState("");
    }
    const search = `<form class="search-field" data-form="search"><span>⌕</span><input name="query" value="${escapeHTML(searchQuery)}" placeholder="Search lessons…"><button class="icon-button" aria-label="Search">↵</button></form>`;
    return `${pageHeading("WATCH · PRACTICE · REMEMBER", "Video Lectures", "Selected lessons from trusted educators, connected to your roadmap.", search)}
      <div class="video-layout"><section class="panel video-player-panel">${selected ? `<div class="video-player"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(selected.youtubeId)}" title="${escapeHTML(selected.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="video-info"><span class="eyebrow">${escapeHTML(selected.provider)} · ${escapeHTML(selected.topic)}</span><h2>${escapeHTML(selected.title)}</h2><p>${escapeHTML(selected.description)}</p><div class="video-actions"><a class="button button-secondary" href="${escapeHTML(selected.url)}" target="_blank" rel="noreferrer">Open on YouTube ↗</a><button class="button button-secondary" data-action="bookmark" data-id="video:${escapeHTML(selected.id)}">${state.bookmarks.includes(`video:${selected.id}`) ? "Bookmarked ◇" : "Bookmark video ◇"}</button><button class="button button-primary" data-action="toggle-video" data-id="${escapeHTML(selected.id)}">${state.watchedVideos.includes(selected.id) ? "Completed ✓" : "Mark complete"}</button></div></div>` : '<div class="empty-state">No lessons match that search.</div>'}</section>
        <aside class="panel video-playlist"><div class="panel-heading"><div><span class="eyebrow">CURATED LESSONS</span><h3>${videos.length} selected lessons</h3></div></div><div class="playlist-list">${videos.map((video, index) => `<button class="playlist-item${video.id === activeVideo ? " selected" : ""}" data-action="select-video" data-id="${escapeHTML(video.id)}"><span class="playlist-play">▷</span><span><strong>${escapeHTML(video.title)}</strong><small>${escapeHTML(video.provider)} · ${escapeHTML(video.topic)}</small></span><span class="playlist-status">${state.watchedVideos.includes(video.id) ? "✓" : String(index + 1).padStart(2, "0")}</span></button>`).join("")}</div><div class="channel-list"><span class="eyebrow">TRUSTED CHANNELS</span>${CATALOG.videoChannels.map((channel) => `<a href="${escapeHTML(channel.url)}" target="_blank" rel="noreferrer">${escapeHTML(channel.name)} <small>${escapeHTML(channel.focus)}</small> ↗</a>`).join("")}</div></aside></div>`;
  }

  function renderLibrary() {
    const query = searchQuery.trim().toLowerCase();
    const resources = CATALOG.resources.filter((item) => !query || `${item.title} ${item.category} ${item.description} ${item.source}`.toLowerCase().includes(query));
    const search = `<form class="search-field" data-form="search"><span>⌕</span><input name="query" value="${escapeHTML(searchQuery)}" placeholder="Search resources…"><button class="icon-button" aria-label="Search">↵</button></form>`;
    return `${pageHeading("DIGITAL LIBRARY", "Your reference shelf", "Official documentation, open courses, and practical learning resources.", search)}<div class="library-banner panel"><span class="metric-symbol cyan">▤</span><div><strong>Free to learn, safe to share</strong><span>Resources open at their original source. Paid books remain with their publishers.</span></div><span class="open-resource-count">${resources.length} resources</span></div><div class="resource-grid">${resources.map((resource) => `<article class="resource-card panel"><div class="resource-top"><span class="resource-icon">▤</span><button class="icon-button bookmark-button${state.bookmarks.includes(resource.id) ? " saved" : ""}" data-action="bookmark" data-id="${escapeHTML(resource.id)}" aria-label="Bookmark ${escapeHTML(resource.title)}">◇</button></div><div class="resource-labels"><span>${escapeHTML(resource.category)}</span><i>·</i><span>${escapeHTML(resource.type)}</span></div><h3>${escapeHTML(resource.title)}</h3><p>${escapeHTML(resource.description)}</p><div class="resource-footer"><span>${escapeHTML(resource.source)}</span><a href="${escapeHTML(resource.url)}" target="_blank" rel="noreferrer" aria-label="Open ${escapeHTML(resource.title)}">↗</a></div></article>`).join("") || '<div class="empty-state panel">Nothing in this shelf yet. Try another search.</div>'}</div>`;
  }

  function renderAssignments() {
    const submitted = Object.values(state.drafts).filter((draft) => draft.submitted).length;
    if (activeAssignment) {
      const assignment = CATALOG.assignments.find((item) => item.id === activeAssignment);
      const draft = state.drafts[activeAssignment] || {};
      if (!assignment) { activeAssignment = ""; return renderAssignments(); }
      return `${pageHeading("PRACTICE & APPLY", "Assignments", "Turn a concept into something you can explain, query, or build.", `<span class="pill-count">✓ ${submitted} submitted</span>`)}<section class="panel assignment-detail"><button class="back-link" data-action="close-assignment">← All assignments</button><div class="assignment-detail-head"><span class="difficulty-tag">${escapeHTML(assignment.difficulty)}</span><span class="resource-label">${escapeHTML(assignment.category)} · ${assignment.minutes} min</span></div><h2>${escapeHTML(assignment.title)}</h2><p class="assignment-objective">${escapeHTML(assignment.objective)}</p><div class="assignment-prompt"><span class="eyebrow">PROBLEM</span><p>${escapeHTML(assignment.prompt)}</p></div><form data-form="assignment"><label class="field-label" for="assignment-answer">Your response</label><textarea id="assignment-answer" class="answer-area" name="body" placeholder="Write your query, findings, or explanation here…">${escapeHTML(draft.body || "")}</textarea><div class="form-actions"><button class="button button-secondary" name="intent" value="save">Save draft</button><button class="button button-primary" name="intent" value="submit">Submit assignment</button></div></form>${draft.submitted ? '<div class="saved-confirm">✓ Submitted and saved. No automatic grading is claimed.</div>' : ""}</section>`;
    }
    return `${pageHeading("PRACTICE & APPLY", "Assignments", "Turn a concept into something you can explain, query, or build.", `<span class="pill-count">✓ ${submitted} submitted</span>`)}<div class="assignment-grid">${CATALOG.assignments.map((item) => {
      const draft = state.drafts[item.id] || {};
      return `<article class="assignment-card panel"><div class="assignment-card-top"><span class="assignment-type">✓ ${escapeHTML(item.category)}</span><span class="difficulty-tag ${escapeHTML(item.difficulty.toLowerCase())}">${escapeHTML(item.difficulty)}</span></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.objective)}</p><div class="assignment-card-bottom"><span>◷ ${item.minutes} min</span>${draft.submitted ? '<span class="status-submitted">✓ Submitted</span>' : draft.body ? '<span class="status-draft">Draft saved</span>' : ""}<button class="text-link" data-action="open-assignment" data-id="${escapeHTML(item.id)}">${draft.body ? "Continue draft" : "Start assignment"} →</button></div></article>`;
    }).join("")}</div>`;
  }

  function renderCodingLab() {
    return `${pageHeading("PRACTICE ENVIRONMENT", "Coding Lab", "Write and save Python snippets as you work through the roadmap.", '<span class="runtime-tag"><span></span> Local draft</span>')}<div class="lab-layout"><section class="panel editor-panel"><div class="editor-toolbar"><div class="editor-file"><span class="python-mark">Py</span><span>practice.py</span></div><span class="language-pill">Python</span></div><form data-form="code"><textarea class="python-textarea" name="code" aria-label="Python practice code" spellcheck="false">${escapeHTML(state.codeDraft)}</textarea><div class="editor-footer"><span>DAYTONAA · practice snippet</span><button class="button button-secondary">Save snippet</button></div></form></section><aside class="panel lab-side"><div class="lab-side-head"><span class="soft-icon">⌘</span><h3>Practice safely</h3></div><p>Your code is saved in this browser. It is not sent to a server or executed.</p><div class="runtime-notice"><span class="notice-indicator"></span><div><strong>Execution is not connected</strong><small>Code execution would require a separate isolated runner.</small></div></div><div class="lab-suggestions"><span class="eyebrow">TRY THIS NEXT</span><a href="#roadmap">Python variables & types →</a><a href="#assignments">Explore a dataset →</a><a href="#quiz-centre">Check your understanding →</a></div></aside></div>`;
  }

  function renderProjects() {
    const query = searchQuery.toLowerCase().trim();
    const projects = CATALOG.projects.filter((project) => !query || `${project.title} ${project.level}`.toLowerCase().includes(query));
    if (activeProject) {
      const project = CATALOG.projects.find((item) => item.title === activeProject);
      if (!project) { activeProject = ""; return renderProjects(); }
      const draft = state.projectSubmissions[project.title] || {};
      return `${pageHeading("BUILD YOUR PORTFOLIO", "Projects", "Guided briefs that take you from a question to a clear, shareable result.", '<span class="pill-count">12 project briefs</span>')}<section class="panel project-modal"><div class="project-modal-header"><div><span class="eyebrow">${escapeHTML(project.level)} PROJECT · GUIDED BRIEF</span><h2>${escapeHTML(project.title)}</h2></div><button class="icon-button" data-action="close-project" aria-label="Close project brief">×</button></div><p class="project-modal-description">${escapeHTML(project.description)}</p><div class="project-steps panel"><strong>WORK THROUGH THESE STEPS</strong><ol><li>Frame one question your dataset can help answer.</li><li>Inspect data types, missing values, and assumptions.</li><li>Analyze and visualize the data to support your observations.</li><li>Share findings, limits, and a next step in a clear README.</li></ol></div><div class="project-tech-row"><span class="eyebrow">SUGGESTED TOOLS</span><div class="project-tags">${project.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div></div><div class="project-tech-row"><span class="eyebrow">DATASET</span><a class="dataset-link" href="${escapeHTML(project.dataset)}" target="_blank" rel="noreferrer">Open original dataset ↗</a></div><form data-form="project" class="project-submit-area"><label class="eyebrow" for="project-notes">YOUR PROJECT NOTES</label><textarea id="project-notes" name="notes" placeholder="What did you build? What did you learn? What would you improve next?">${escapeHTML(draft.notes || "")}</textarea><label class="repo-field">GitHub repository URL<input type="url" name="repositoryUrl" value="${escapeHTML(draft.repositoryUrl || "")}" placeholder="https://github.com/you/project"></label><div class="project-submit-footer"><span>Save your notes or submit a reflection when ready.</span><div><button class="button button-secondary" name="intent" value="save">Save draft</button><button class="button button-primary" name="intent" value="submit">Submit reflection</button></div></div>${draft.submitted ? '<div class="saved-confirm">✓ Reflection saved. Work is not automatically graded.</div>' : ""}</form></section>`;
    }
    const search = `<div class="project-level-tabs"><button data-action="project-filter" data-query="">All projects</button><button data-action="project-filter" data-query="Beginner">Beginner</button><button data-action="project-filter" data-query="Intermediate">Intermediate</button><button data-action="project-filter" data-query="Advanced">Advanced</button></div>`;
    return `${pageHeading("BUILD YOUR PORTFOLIO", "Projects", "Guided briefs that take you from a question to a clear, shareable result.", `<span class="pill-count">${projects.length} project briefs</span>`)}${search}<div class="project-grid">${projects.map((project, index) => `<article class="project-card panel"><div class="project-card-visual"><span class="project-difficulty">${escapeHTML(project.level)}</span><span class="project-number">${String(index + 1).padStart(2, "0")}</span><span class="project-visual-icon">◇</span></div><div class="project-card-body"><div class="project-tags">${project.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div><h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.description)}</p><button class="text-link" data-action="open-project" data-id="${escapeHTML(project.title)}">Open project brief →</button></div></article>`).join("") || '<div class="empty-state panel">No projects match that filter.</div>'}</div>`;
  }

  function renderQuiz() {
    const last = state.quizAttempts.at(-1);
    return `${pageHeading("CHECK YOUR UNDERSTANDING", "Quiz Centre", "Short practice questions with explanations after you submit.", `<span class="pill-count">Best score · ${state.quizBest}%</span>`)}<div class="quiz-layout"><section class="panel quiz-main"><div class="quiz-intro">Choose one answer for each question. Your score and explanations stay in this browser.</div><form data-form="quiz">${CATALOG.starterQuiz.map((item, index) => `<div class="quiz-question"><div class="question-count">QUESTION ${String(index + 1).padStart(2, "0")}</div><h3>${escapeHTML(item.question)}</h3><div class="quiz-choices">${item.choices.map((choice, choiceIndex) => `<label class="quiz-choice"><input type="radio" name="q${index}" value="${choiceIndex}" required><span class="choice-radio"></span><span>${escapeHTML(choice)}</span></label>`).join("")}</div>${last ? `<div class="explanation">${last.answers[index] === item.answer ? "✓ Correct." : "Review this one."} ${escapeHTML(item.explanation)}</div>` : ""}</div>`).join("")}<button class="button button-primary submit-quiz">Submit answers</button></form>${last ? `<div class="quiz-result"><div class="result-score">${last.score}<small>/ ${last.total}</small></div><div><strong>${last.score} of ${last.total} correct</strong><span>Your latest practice attempt is recorded.</span></div></div>` : ""}</section><aside class="panel quiz-side"><span class="eyebrow">PRACTICE, THEN REFLECT</span><h3>Low pressure, real learning</h3><p>Use quick quizzes to find the next topic worth a second look.</p><div class="quiz-side-stat"><span>Best score</span><strong>${state.quizBest}%</strong></div>${progressBar(state.quizBest, 100)}<div class="quiz-history"><span class="eyebrow">RECENT ATTEMPTS</span>${state.quizAttempts.slice(-5).reverse().map((attempt) => `<div><span>${escapeHTML(attempt.date)}</span><strong>${attempt.score}/${attempt.total}</strong></div>`).join("") || "<small>Your attempts will appear here.</small>"}</div></aside></div>`;
  }

  function tutorReply(prompt) {
    const value = prompt.toLowerCase();
    if (value.includes("p-value") || value.includes("p value")) return "A p-value describes how unusual your result would be if the null hypothesis were true. It is not the probability that the null hypothesis is true. Consider effect size and assumptions as well. See the OpenStax statistics resource in your library.";
    if (value.includes("pandas") || value.includes("dataframe") || value.includes("data frame")) return "A Series is a one-dimensional labeled sequence. A DataFrame combines labeled columns into a table. Start with df.shape, df.dtypes, and df.isna().sum() before transforming data. Try the Pandas lessons in Video Lectures.";
    if (value.includes("python list") || value.includes("list in python")) return "A Python list is an ordered, mutable sequence. Indexing starts at zero, append adds an item, and a for loop visits items in order. Example: scores = [82, 91, 76]; scores.append(88); average = sum(scores) / len(scores).";
    if (value.includes("sql") || value.includes("query") || value.includes("join")) return "Read a SQL query from its source outward: FROM selects a table, JOIN combines related rows, WHERE filters rows, and SELECT chooses output columns. Add ORDER BY when the result needs a stable order.";
    const topic = currentTopic();
    return `Start with ${topic.title} in ${topic.module}. Write one small example, explain what each part means, and check your explanation against the topic objective. This assistant uses bundled explainers only; it does not contact an online model.`;
  }

  function renderTutor() {
    const messages = state.tutorMessages;
    return `${pageHeading("YOUR PERSONAL STUDY COMPANION", "Offline Study Assistant", "Bundled explainers and curated reading links. Your question stays in this browser.", '<span class="runtime-tag"><span></span> Runs locally</span>')}<div class="tutor-layout"><section class="panel tutor-chat"><div class="chat-topbar"><div class="tutor-avatar">✧</div><div><strong>DAYTONAA Study Guide</strong><span>Bundled explainers and references</span></div></div><div class="chat-messages" id="chat-messages">${messages.length ? messages.map((message) => `<div class="chat-message ${message.role}"><span class="message-avatar ${message.role}">${message.role === "assistant" ? "✧" : "D"}</span><div class="message-bubble">${escapeHTML(message.content)}</div></div>`).join("") : '<div class="tutor-welcome"><div class="welcome-orb">✧</div><h2>Where should we start?</h2><p>Try one of the included explainers or ask for a starting point on your current roadmap topic.</p><div class="suggestion-chips"><button type="button" data-action="fill-prompt" data-prompt="Explain a Python list">Explain a Python list ↗</button><button type="button" data-action="fill-prompt" data-prompt="What is a p-value?">What is a p-value? ↗</button><button type="button" data-action="fill-prompt" data-prompt="How does a Pandas DataFrame work?">How does a Pandas DataFrame work? ↗</button></div></div>'}</div><form class="chat-composer" data-form="tutor"><textarea name="prompt" placeholder="Ask for a local study starting point…" rows="2" required></textarea><div class="composer-footer"><span>Bundled guide · no online tutor request</span><button class="send-button" type="submit" aria-label="Send message">↑</button></div></form></section><aside class="panel tutor-context"><span class="eyebrow">LOCAL STUDY GUIDE</span><h3>Private by default</h3><p>This page uses bundled explainers and the DAYTONAA resource list. It does not send prompts to an online model.</p><div class="tutor-context-line"><span>▤</span><div><strong>Built-in concepts</strong><small>Python lists, p-values, Pandas tables, and SQL query structure.</small></div></div><div class="tutor-context-line"><span>⌘</span><div><strong>Practice pointers</strong><small>Short next steps to apply an idea.</small></div></div><div class="tutor-setup-note"><span class="notice-indicator"></span><div><strong>No external service</strong><small>The assistant works without a provider key or tutor request.</small></div></div></aside></div>`;
  }

  function renderNotes() {
    const notes = [...state.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    const note = notes.find((item) => item.id === activeNote) || null;
    if (note) activeNote = note.id;
    return `${pageHeading("YOUR SECOND BRAIN", "My Notes", "Capture questions, examples, and ideas as you learn.", '<button class="button button-primary" data-action="new-note">＋ New note</button>')}<div class="notes-layout"><aside class="panel notes-sidebar"><div class="notes-sidebar-head"><span class="eyebrow">YOUR NOTEBOOK</span><span class="note-count">${notes.length} notes</span></div><div class="notes-list">${notes.map((item) => `<button class="note-list-item${note?.id === item.id ? " selected" : ""}" data-action="select-note" data-id="${escapeHTML(item.id)}"><span class="note-list-icon">▱</span><span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.body || "No content yet").slice(0, 65)}</small></span>${item.pinned ? "◇" : ""}</button>`).join("") || '<div class="notes-empty">No notes yet.<br>Start with an idea.</div>'}</div></aside><section class="panel note-editor"><form data-form="note"><input type="hidden" name="id" value="${escapeHTML(note?.id || "")}"><div class="note-editor-toolbar"><span class="note-breadcrumb">▱ ${note ? "Editing note" : "New note"}</span>${note ? `<button class="icon-button" type="button" data-action="pin-note" data-id="${escapeHTML(note.id)}" aria-label="Pin note">${note.pinned ? "◆" : "◇"}</button><button class="icon-button delete-note" type="button" data-action="delete-note" data-id="${escapeHTML(note.id)}" aria-label="Delete note">×</button>` : ""}</div><input class="note-title-input" name="title" placeholder="Untitled note" value="${escapeHTML(note?.title || "")}" required><div class="markdown-hint"><span>Markdown · code blocks · lists</span><span>Saved when you click Save note</span></div><textarea class="note-body-input" name="body" placeholder="Start writing…\n\nTip: use # for headings, - for lists, and backticks for code.">${escapeHTML(note?.body || "")}</textarea><div class="note-editor-bottom"><span>Private to this browser</span><button class="button button-primary" type="submit">Save note</button></div></form></section></div>`;
  }

  function renderAnalytics() {
    const week = weekData();
    const max = Math.max(60, ...week.map((day) => day.minutes));
    return `${pageHeading("YOUR LEARNING DATA", "Analytics", "A clear view of activity you have recorded in DAYTONAA.", '<span class="pill-count">7-day view</span>')}<div class="analytics-kpis">${metric("◷", "cyan", "STUDY TIME", totalMinutes(), "min", "Total recorded sessions")}${metric("✓", "violet", "TOPICS COMPLETE", state.completedTopics.length, `/ ${topics.length}`, `${Math.round(state.completedTopics.length / topics.length * 100)}% roadmap progress`)}${metric("✦", "orange", "CURRENT STREAK", streakCount(), "days", "Recorded study days")}${metric("▤", "blue", "ASSIGNMENTS", Object.values(state.drafts).filter((draft) => draft.submitted).length, "", "Saved submissions")}</div><div class="analytics-grid"><section class="panel analytics-activity"><div class="panel-heading"><div><h3>Study activity</h3><p>Recorded minutes per day · last 7 days</p></div></div><div class="analytics-chart">${week.map((day) => `<div class="analytics-column"><div class="analytics-bar-track"><i style="height:${Math.max(day.minutes ? 6 : 2, day.minutes / max * 100)}%" title="${day.minutes} minutes"></i></div><small>${day.label}</small></div>`).join("")}</div><div class="chart-axis"><span>7 days ago</span><span>Today</span></div></section><section class="panel mastery-card"><div class="panel-heading"><div><h3>Roadmap progress</h3><p>Topic completion by level</p></div></div>${CATALOG.levels.map((level) => { const items = topics.filter((topic) => topic.level === level.number); const done = items.filter((topic) => state.completedTopics.includes(topic.id)).length; return `<div class="mastery-row"><div><span class="mastery-dot ${escapeHTML(level.color)}"></span><span>0${level.number} ${escapeHTML(level.title)}</span><small>${done}/${items.length}</small></div><div class="mastery-track"><i style="width:${done / Math.max(1, items.length) * 100}%"></i></div></div>`; }).join("")}</section></div>`;
  }

  function renderPlanner() {
    const week = weekData();
    const goal = Math.min(100, Math.round(minutesToday() / Math.max(1, state.goalMinutes) * 100));
    const tasks = [...state.tasks].sort((a, b) => a.date.localeCompare(b.date));
    return `${pageHeading("MAKE SPACE TO LEARN", "Study Planner", "Turn a big roadmap into small, realistic learning sessions.", '<button class="button button-secondary" data-action="log-session">◷ Log 25 min</button>')}<div class="planner-layout"><div class="planner-main"><section class="panel week-card"><div class="panel-heading"><div><h3>This week</h3><p>Plan one small step at a time.</p></div><span class="month-label">${todayISO()}</span></div><div class="week-strip">${week.map((day) => { const count = state.tasks.filter((task) => task.date === day.date && !task.done).length; return `<div class="week-day${day.date === todayISO() ? " today" : ""}${count ? " has-tasks" : ""}"><span>${day.label}</span><strong>${day.day}</strong><i>${count ? `${count} tasks` : ""}</i></div>`; }).join("")}</div><form class="task-create" data-form="task"><input name="title" placeholder="Add a study task…" required maxlength="200"><input aria-label="Task date" name="date" type="date" value="${todayISO()}"><button class="button button-primary" type="submit">＋ Add</button></form></section><section class="panel planned-tasks">${panelHeading("", "Study tasks", `<span>${tasks.length} planned</span>`)}${tasks.length ? `<div class="planner-task-list">${tasks.map((task) => `<div class="planner-task${task.done ? " done" : ""}"><button class="task-check${task.done ? " done" : ""}" data-action="toggle-task" data-id="${escapeHTML(task.id)}" aria-label="Toggle ${escapeHTML(task.title)}">${task.done ? "✓" : ""}</button><div class="planner-task-copy"><strong>${escapeHTML(task.title)}</strong><small>▦ ${escapeHTML(task.date)}</small></div><button class="icon-button delete-note" data-action="delete-task" data-id="${escapeHTML(task.id)}" aria-label="Delete task">×</button></div>`).join("")}</div>` : '<div class="planner-empty"><span>▦</span><strong>Your study plan starts here</strong><span>Add a clear next step, even if it is just 20 minutes.</span></div>'}</section></div><aside class="panel planner-side"><div class="goal-orb"><div><strong>${goal}%</strong><small>today</small></div></div><span class="eyebrow">DAILY LEARNING GOAL</span><h3>A little progress adds up.</h3><p>You have recorded ${minutesToday()} of ${state.goalMinutes} minutes today.</p>${progressBar(minutesToday(), state.goalMinutes)}<a class="text-link" href="#settings">Adjust daily goal →</a></aside></div>`;
  }

  function renderSettings() {
    return `${pageHeading("MAKE IT YOURS", "Settings", "Tune your workspace and manage the data saved in this browser.")}<div class="settings-layout"><section class="panel settings-panel"><div class="settings-section-head"><span class="settings-icon">◷</span><div><h3>Daily learning goal</h3><p>Choose a target that fits your routine.</p></div></div><form class="goal-setting-form" data-form="settings"><label for="display-name">Display name</label><input id="display-name" name="displayName" type="text" value="${escapeHTML(state.displayName)}" maxlength="60"><label for="goal-minutes">Minutes per day</label><div><input id="goal-minutes" name="goalMinutes" type="number" min="5" max="600" step="5" value="${state.goalMinutes}"><span>minutes</span><button class="button button-primary">Save settings</button></div><div class="theme-options"><button type="button" class="${state.theme === "dark" ? "selected" : ""}" data-action="theme" data-theme="dark">◐ Dark</button><button type="button" class="${state.theme === "light" ? "selected" : ""}" data-action="theme" data-theme="light">☼ Light</button></div></form></section><section class="panel settings-panel"><div class="settings-section-head"><span class="settings-icon blue">◉</span><div><h3>Workspace storage</h3><p>DAYTONAA saves locally in this browser.</p></div></div><div class="account-state"><p>Your notes, goals, and progress stay on this device. This static version does not create online accounts or sync to a server.</p><div class="sync-line"><span class="sync-indicator synced"></span><span>Local browser storage is active.</span></div></div></section><section class="panel settings-panel data-settings"><div class="settings-section-head"><span class="settings-icon cyan">▱</span><div><h3>Your learning data</h3><p>${state.completedTopics.length} topics, ${state.notes.length} notes, ${state.sessions.length} sessions.</p></div></div><div class="data-summary"><span>${state.bookmarks.length} bookmarks</span><span>${state.tasks.length} study tasks</span><span>${state.quizAttempts.length} quiz attempts</span><span>${Object.values(state.drafts).filter((draft) => draft.submitted).length} assignments submitted</span></div><button class="button button-danger" data-action="clear-data">Clear workspace data</button><p class="data-caveat">Clearing data removes DAYTONAA progress from this browser only.</p></section><section class="panel settings-panel"><div class="settings-section-head"><span class="settings-icon violet">✧</span><div><h3>Offline study guide</h3><p>Bundled explainers with no provider connection.</p></div></div><a class="text-link" href="#ai-tutor">Open study assistant →</a></section></div>`;
  }

  function render() {
    const section = currentSection();
    document.documentElement.dataset.theme = state.theme || "dark";
    renderNavigation(section);
    updateProfile();
    $("#breadcrumb-current").textContent = sectionTitles[section] || "Overview";
    const renderers = {
      overview: renderOverview, learning: renderLearning, roadmap: renderRoadmap, videos: renderVideos,
      library: renderLibrary, assignments: renderAssignments, "coding-lab": renderCodingLab,
      projects: renderProjects, "quiz-centre": renderQuiz, "ai-tutor": renderTutor,
      notes: renderNotes, analytics: renderAnalytics, "study-planner": renderPlanner, settings: renderSettings,
    };
    const main = $("#app-content");
    main.classList.remove("page-enter");
    main.innerHTML = `${renderers[section]()}<footer class="footer"><span>DAYTONAA · Your personal data science university</span><span><i class="footer-sparkle">✦</i> Learn. Experiment. Analyse. Build.</span></footer>`;
    requestAnimationFrame(() => main.classList.add("page-enter"));
    if (section === "ai-tutor") $("#chat-messages")?.scrollTo({ top: 999999, behavior: "smooth" });
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === "toggle-topic") {
      state.completedTopics = state.completedTopics.includes(id) ? state.completedTopics.filter((item) => item !== id) : [...state.completedTopics, id];
      saveState("Topic progress saved");
    } else if (action === "bookmark") {
      state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter((item) => item !== id) : [...state.bookmarks, id];
      saveState(state.bookmarks.includes(id) ? "Bookmark saved" : "Bookmark removed");
    } else if (action === "toggle-video") {
      state.watchedVideos = state.watchedVideos.includes(id) ? state.watchedVideos.filter((item) => item !== id) : [...state.watchedVideos, id];
      saveState("Video progress saved");
    } else if (action === "select-video") {
      activeVideo = id;
      render();
      return;
    } else if (action === "open-assignment") {
      activeAssignment = id;
    } else if (action === "close-assignment") {
      activeAssignment = "";
    } else if (action === "open-project") {
      activeProject = id;
    } else if (action === "close-project") {
      activeProject = "";
    } else if (action === "project-filter") {
      searchQuery = button.dataset.query || "";
    } else if (action === "new-note") {
      activeNote = "";
    } else if (action === "select-note") {
      activeNote = id;
    } else if (action === "pin-note") {
      const note = state.notes.find((item) => item.id === id);
      if (note) note.pinned = !note.pinned;
      saveState("Note updated");
    } else if (action === "delete-note") {
      state.notes = state.notes.filter((item) => item.id !== id);
      activeNote = "";
      saveState("Note deleted");
    } else if (action === "toggle-task") {
      const task = state.tasks.find((item) => item.id === id);
      if (task) task.done = !task.done;
      saveState("Study plan updated");
    } else if (action === "delete-task") {
      state.tasks = state.tasks.filter((item) => item.id !== id);
      saveState("Task removed");
    } else if (action === "log-session") {
      state.sessions.push({ date: todayISO(), minutes: 25 });
      saveState("25 minutes added to today's activity");
    } else if (action === "theme") {
      state.theme = button.dataset.theme === "light" ? "light" : "dark";
      saveState("Theme updated");
    } else if (action === "clear-data") {
      if (!window.confirm("Clear your saved DAYTONAA workspace from this browser?")) return;
      state = defaultState();
      activeNote = "";
      saveState("Workspace data cleared");
    } else if (action === "fill-prompt") {
      const input = $('[data-form="tutor"] textarea');
      if (input) { input.value = button.dataset.prompt; input.focus(); }
      return;
    }
    render();
  }

  function handleSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const kind = form.dataset.form;
    if (kind === "search") {
      searchQuery = String(data.get("query") || "").slice(0, 100);
    } else if (kind === "assignment") {
      const body = String(data.get("body") || "").slice(0, 50000);
      const intent = event.submitter?.value || "save";
      if (intent === "submit" && !body.trim()) { toast("Add your response before submitting."); return; }
      const old = state.drafts[activeAssignment] || {};
      state.drafts[activeAssignment] = { body, submitted: intent === "submit" || Boolean(old.submitted) };
      saveState(intent === "submit" ? "Assignment submitted" : "Draft saved");
    } else if (kind === "project") {
      const notes = String(data.get("notes") || "").slice(0, 30000);
      const repositoryUrl = String(data.get("repositoryUrl") || "").trim().slice(0, 500);
      const intent = event.submitter?.value || "save";
      if (repositoryUrl && !/^https?:\/\//i.test(repositoryUrl)) { toast("Use a valid http or https repository link."); return; }
      const old = state.projectSubmissions[activeProject] || {};
      state.projectSubmissions[activeProject] = { notes, repositoryUrl, submitted: intent === "submit" || Boolean(old.submitted) };
      saveState(intent === "submit" ? "Project reflection saved" : "Project draft saved");
    } else if (kind === "quiz") {
      const answers = CATALOG.starterQuiz.map((_, index) => Number(data.get(`q${index}`)));
      if (answers.some((answer) => !Number.isInteger(answer))) { toast("Choose an answer for every question."); return; }
      const score = answers.reduce((sum, answer, index) => sum + (answer === CATALOG.starterQuiz[index].answer ? 1 : 0), 0);
      const attempt = { score, total: answers.length, answers, date: todayISO() };
      state.quizAttempts.push(attempt);
      state.quizAttempts = state.quizAttempts.slice(-20);
      state.quizBest = Math.max(state.quizBest, Math.round(score / Math.max(1, answers.length) * 100));
      saveState("Quiz result saved");
    } else if (kind === "tutor") {
      const prompt = String(data.get("prompt") || "").trim().slice(0, 2000);
      if (!prompt) return;
      state.tutorMessages.push({ role: "user", content: prompt }, { role: "assistant", content: tutorReply(prompt) });
      state.tutorMessages = state.tutorMessages.slice(-24);
      saveState("Study conversation saved");
    } else if (kind === "note") {
      const id = String(data.get("id") || makeId());
      const old = state.notes.find((note) => note.id === id) || {};
      const note = { id, title: String(data.get("title") || "Untitled note").trim().slice(0, 160) || "Untitled note", body: String(data.get("body") || "").slice(0, 50000), pinned: Boolean(old.pinned), updatedAt: new Date().toISOString() };
      state.notes = [note, ...state.notes.filter((item) => item.id !== id)].slice(0, 200);
      activeNote = id;
      saveState("Note saved");
    } else if (kind === "task") {
      const title = String(data.get("title") || "").trim().slice(0, 200);
      if (!title) return;
      const date = String(data.get("date") || todayISO());
      state.tasks.push({ id: makeId(), title, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO(), done: false });
      state.tasks = state.tasks.slice(-200);
      saveState("Study task added");
    } else if (kind === "code") {
      state.codeDraft = String(data.get("code") || "").slice(0, 30000);
      saveState("Code snippet saved");
    } else if (kind === "settings") {
      const goal = Number(data.get("goalMinutes"));
      state.goalMinutes = Number.isFinite(goal) ? Math.max(5, Math.min(600, goal)) : 45;
      state.displayName = String(data.get("displayName") || "Learner").trim().slice(0, 60) || "Learner";
      saveState("Settings saved");
    }
    render();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) { handleAction(button); return; }
    const levelCard = event.target.closest("[data-level-search]");
    if (levelCard) {
      event.preventDefault();
      searchQuery = levelCard.dataset.levelSearch;
      if (currentSection() !== "roadmap") {
        preserveSearchOnRoute = true;
        location.hash = "roadmap";
      } else render();
    }
  });
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("input", (event) => {
    const form = event.target.closest('form[data-form="note"]');
    if (!form) return;
    clearTimeout(noteAutosaveTimer);
    noteAutosaveTimer = setTimeout(() => {
      const data = new FormData(form);
      const idField = form.querySelector('input[name="id"]');
      const id = String(data.get("id") || makeId());
      idField.value = id;
      activeNote = id;
      const old = state.notes.find((note) => note.id === id) || {};
      const note = {
        id,
        title: String(data.get("title") || "Untitled note").trim().slice(0, 160) || "Untitled note",
        body: String(data.get("body") || "").slice(0, 50000),
        pinned: Boolean(old.pinned),
        updatedAt: new Date().toISOString(),
      };
      state.notes = [note, ...state.notes.filter((item) => item.id !== id)].slice(0, 200);
      saveState("");
      const hint = form.querySelector(".markdown-hint span:last-child");
      if (hint) hint.textContent = "Autosaved just now";
    }, 500);
  });
  window.addEventListener("hashchange", () => {
    activeAssignment = "";
    activeProject = "";
    if (!preserveSearchOnRoute) searchQuery = "";
    preserveSearchOnRoute = false;
    render();
    $("#app-content").focus({ preventScroll: true });
    closeMenu();
  });

  const frame = $("#app-frame");
  const sidebar = $("#sidebar");
  const scrim = $("[data-menu-close]");
  if (localStorage.getItem("daytonaa.sidebar.collapsed") === "true") frame.classList.add("sidebar-collapsed");
  $("[data-collapse]").addEventListener("click", () => {
    frame.classList.toggle("sidebar-collapsed");
    localStorage.setItem("daytonaa.sidebar.collapsed", String(frame.classList.contains("sidebar-collapsed")));
  });
  function closeMenu() { sidebar.classList.remove("mobile-open"); scrim.hidden = true; }
  $("[data-menu-open]").addEventListener("click", () => { sidebar.classList.add("mobile-open"); scrim.hidden = false; });
  scrim.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault(); location.hash = "roadmap"; setTimeout(() => $('.search-field input')?.focus(), 20);
    }
  });

  render();
})();
