(() => {
  const landing = document.getElementById("landing");
  const experience = document.getElementById("experience");
  const enterLink = document.getElementById("enter-link");
  const video = document.getElementById("man-video");
  const volumeSlider = document.getElementById("volume");
  const muteToggle = document.getElementById("mute-toggle");
  const iconSpeaker = muteToggle.querySelector(".icon--speaker");
  const iconMuted = muteToggle.querySelector(".icon--muted");
  const copyBtn = document.getElementById("copy-ca");
  const toast = document.getElementById("toast");
  const stamp = document.getElementById("stamp");
  const timerEl = document.getElementById("man-timer");
  const proveBtn = document.getElementById("prove-btn");
  const buyBtn = document.getElementById("buy-btn");
  const buyNudge = document.getElementById("buy-nudge");
  const canvas = document.getElementById("man-fx");
  const ctx = canvas.getContext("2d");

  const DEFAULT_VOLUME = 0.7;
  const MAX_CHIPS = 28;
  const MAX_SPARKS = 40;
  const CLICK_BURST = 5;

  let lastVolume = DEFAULT_VOLUME;
  let enteredAt = 0;
  let timerId = null;
  let toastTimer = null;
  let stampTimer = null;
  let nudgeHideTimer = null;
  let proveHoldTimer = null;
  let proving = false;
  let nudgeShownThisHold = false;

  /** Set this when the token launches */
  const CONTRACT_ADDRESS = "";

  const chips = [];
  const sparks = [];

  video.volume = DEFAULT_VOLUME;
  video.muted = false;

  function syncMuteUI() {
    const muted = video.muted || video.volume === 0;
    iconSpeaker.hidden = muted;
    iconMuted.hidden = !muted;
    muteToggle.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    muteToggle.title = muted ? "Unmute" : "Mute";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  function flashStamp() {
    stamp.hidden = false;
    clearTimeout(stampTimer);
    stampTimer = setTimeout(() => {
      stamp.hidden = true;
    }, 550);
  }

  function positionBuyNudge() {
    const buyRect = buyBtn.getBoundingClientRect();
    const expRect = experience.getBoundingClientRect();
    const nudgeW = buyNudge.offsetWidth || 220;

    let left = buyRect.left + buyRect.width / 2 - nudgeW / 2 - expRect.left;
    left = Math.max(10, Math.min(left, window.innerWidth - nudgeW - 10));

    buyNudge.style.left = `${left}px`;
    buyNudge.style.top = `${buyRect.bottom - expRect.top + 10}px`;
  }

  function showBuyNudge() {
    buyNudge.hidden = false;
    buyBtn.classList.add("is-nudged");
    // Layout then position (needs visible for measurements)
    requestAnimationFrame(() => {
      positionBuyNudge();
    });
    clearTimeout(nudgeHideTimer);
    nudgeHideTimer = setTimeout(hideBuyNudge, 4200);
  }

  function hideBuyNudge() {
    buyNudge.hidden = true;
    buyBtn.classList.remove("is-nudged");
    clearTimeout(nudgeHideTimer);
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function startTimer() {
    enteredAt = Date.now();
    clearInterval(timerId);
    timerId = setInterval(() => {
      timerEl.textContent = formatTime(Date.now() - enteredAt);
    }, 250);
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    if (!buyNudge.hidden) positionBuyNudge();
  }

  function trimChips() {
    while (chips.length > MAX_CHIPS) chips.shift();
  }

  function trimSparks() {
    while (sparks.length > MAX_SPARKS) sparks.shift();
  }

  function spawnBurst(x, y, count = CLICK_BURST) {
    const room = Math.max(0, MAX_CHIPS - chips.length);
    const n = Math.min(count, room || (chips.length >= MAX_CHIPS ? 0 : count));
    // If at cap, replace oldest instead of stacking forever
    const toSpawn = n > 0 ? n : Math.min(count, 3);
    if (n === 0) {
      chips.splice(0, toSpawn);
    }

    for (let i = 0; i < toSpawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.55 + Math.random() * 1.6;
      chips.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.9,
        life: 1,
        rot: (Math.random() - 0.5) * 0.35,
        spin: (Math.random() - 0.5) * 0.03,
        text: Math.random() > 0.35 ? "$MAN" : "MAN",
        size: 28 + Math.random() * 18,
      });
    }
    trimChips();
  }

  function spawnSparks(x, y) {
    const room = Math.max(0, MAX_SPARKS - sparks.length);
    const n = Math.min(4, room || 2);
    if (room === 0) sparks.splice(0, n);

    for (let i = 0; i < n; i++) {
      sparks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 1,
      });
    }
    trimSparks();
  }

  function drawFx() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const heavy = chips.length > 18;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.018;
      c.vx *= 0.995;
      c.rot += c.spin;
      // ~2.8s readable lifetime
      c.life -= 0.0036;

      if (c.life <= 0) {
        chips.splice(i, 1);
        continue;
      }

      // Stay fully readable for most of the life, fade only at the end
      const alpha = c.life > 0.25 ? 1 : c.life / 0.25;

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#d6ff00";
      ctx.font = `700 ${c.size}px "Bebas Neue", sans-serif`;
      if (!heavy) {
        ctx.shadowColor = "rgba(214, 255, 0, 0.75)";
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.035;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = s.life;
      ctx.fillStyle = "#eaff4d";
      ctx.fillRect(s.x, s.y, 3, 3);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(drawFx);
  }

  function enterExperience(event) {
    event.preventDefault();

    landing.hidden = true;
    experience.hidden = false;

    video.muted = false;
    video.volume = Number(volumeSlider.value) || DEFAULT_VOLUME;
    lastVolume = video.volume || lastVolume;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        video.muted = true;
        syncMuteUI();
        video.play().catch(() => {});
      });
    }

    syncMuteUI();
    startTimer();
    resizeCanvas();
    spawnBurst(window.innerWidth / 2, window.innerHeight * 0.35, 6);
    history.replaceState(null, "", "#experience");
  }

  function setProving(active) {
    proving = active;
    experience.classList.toggle("is-proving", active);
    if (active) {
      video.playbackRate = 1.65;
      flashStamp();
    } else {
      video.playbackRate = 1;
      clearTimeout(proveHoldTimer);
      proveHoldTimer = null;
      nudgeShownThisHold = false;
    }
  }

  function startProveHold() {
    nudgeShownThisHold = false;
    clearTimeout(proveHoldTimer);
    proveHoldTimer = setTimeout(() => {
      if (!proving || nudgeShownThisHold) return;
      nudgeShownThisHold = true;
      showBuyNudge();
    }, 1000);
  }

  enterLink.addEventListener("click", enterExperience);

  volumeSlider.addEventListener("input", () => {
    const value = Number(volumeSlider.value);
    video.volume = value;
    video.muted = value === 0;
    if (value > 0) lastVolume = value;
    syncMuteUI();
  });

  muteToggle.addEventListener("click", () => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = lastVolume || DEFAULT_VOLUME;
      volumeSlider.value = String(video.volume);
    } else {
      lastVolume = video.volume || lastVolume;
      video.muted = true;
    }
    syncMuteUI();
  });

  copyBtn.addEventListener("click", async () => {
    const ca = copyBtn.dataset.ca || CONTRACT_ADDRESS;
    if (!ca) {
      showToast("Waiting for launch");
      return;
    }
    try {
      await navigator.clipboard.writeText(ca);
      showToast("Contract copied");
    } catch {
      showToast("Copy failed");
    }
  });

  buyBtn.addEventListener("click", () => {
    hideBuyNudge();
  });

  experience.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".top-stack, .man-meter, .toast, .buy-nudge, .volume")) return;
    spawnBurst(event.clientX, event.clientY, CLICK_BURST);
    spawnSparks(event.clientX, event.clientY);
  });

  const bindProve = (el) => {
    const start = (e) => {
      e.preventDefault();
      setProving(true);
      startProveHold();
      spawnBurst(window.innerWidth / 2, window.innerHeight / 2, 4);
    };
    const end = () => setProving(false);
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
    el.addEventListener("pointercancel", end);
  };
  bindProve(proveBtn);

  window.addEventListener("keydown", (e) => {
    if (landing.hidden === false) return;
    if (e.code === "KeyM" && !e.repeat) {
      setProving(true);
      startProveHold();
      spawnBurst(window.innerWidth / 2, window.innerHeight / 2, 4);
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyM") setProving(false);
  });

  window.addEventListener("resize", resizeCanvas);

  if (location.hash === "#experience") {
    history.replaceState(null, "", location.pathname);
  }

  syncMuteUI();
  resizeCanvas();
  drawFx();
})();
