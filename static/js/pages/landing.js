/* ============================================================
   MyVibe — Landing page GSAP animations
   ============================================================ */
(function () {
  "use strict";

  if (typeof gsap === "undefined") {
    console.warn("GSAP not loaded; skipping landing animations.");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Respect user motion preferences
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    gsap.set("[data-anim]", { opacity: 1, y: 0, scale: 1, rotate: 0 });
    return;
  }

  // Set initial state hidden so nothing flashes before timeline plays
  gsap.set("[data-anim='title']", { yPercent: 110, opacity: 0 });
  gsap.set("[data-anim='badge']", { opacity: 0, y: 12 });
  gsap.set("[data-anim='lede']", { opacity: 0, y: 24 });
  gsap.set("[data-anim='cta']", { opacity: 0, y: 24 });
  gsap.set("[data-anim='stats']", { opacity: 0, y: 24 });
  gsap.set("[data-anim='card-1']", { opacity: 0, y: 60, rotate: -12, scale: 0.92 });
  gsap.set("[data-anim='card-2']", { opacity: 0, y: 80, rotate: 10, scale: 0.92 });
  gsap.set("[data-anim='chip']", { opacity: 0, scale: 0.4, rotate: -20 });
  gsap.set("[data-anim='stop']", { opacity: 0, x: -20 });
  gsap.set("[data-anim='scroll']", { opacity: 0 });

  // -----------------------------------------------------------
  // HERO INTRO TIMELINE
  // -----------------------------------------------------------
  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    delay: 0.15,
  });

  tl.to(".landing-nav", {
      y: 0,
      opacity: 1,
      duration: 0.9,
      ease: "power2.out",
      from: { y: -30, opacity: 0 },
      startAt: { y: -30, opacity: 0 },
    }, 0)
    .to("[data-anim='badge']", {
      opacity: 1,
      y: 0,
      duration: 0.7,
    }, 0.2)
    .to("[data-anim='title']", {
      yPercent: 0,
      opacity: 1,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.09,
    }, 0.35)
    .to("[data-anim='lede']", {
      opacity: 1,
      y: 0,
      duration: 0.8,
    }, 0.85)
    .to("[data-anim='cta']", {
      opacity: 1,
      y: 0,
      duration: 0.8,
    }, 1.0)
    .to("[data-anim='stats']", {
      opacity: 1,
      y: 0,
      duration: 0.8,
    }, 1.15)
    // Cards
    .to("[data-anim='card-1']", {
      opacity: 1,
      y: 0,
      rotate: -3,
      scale: 1,
      duration: 1.2,
      ease: "expo.out",
    }, 0.5)
    .to("[data-anim='card-2']", {
      opacity: 1,
      y: 0,
      rotate: 2,
      scale: 1,
      duration: 1.3,
      ease: "expo.out",
    }, 0.75)
    .to("[data-anim='stop']", {
      opacity: 1,
      x: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: "power2.out",
    }, 1.2)
    .to("[data-anim='chip']", {
      opacity: 1,
      scale: 1,
      rotate: 8,
      duration: 0.7,
      ease: "back.out(2.5)",
    }, 1.7)
    .to("[data-anim='scroll']", {
      opacity: 1,
      duration: 0.6,
    }, 2.0);

  // -----------------------------------------------------------
  // FLOATING ROUTE CARDS (continuous gentle bob)
  // -----------------------------------------------------------
  gsap.to(".route-card-glass--map", {
    y: -10,
    duration: 4,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    delay: 2,
  });
  gsap.to(".route-card-glass--itinerary", {
    y: 12,
    duration: 5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    delay: 2.5,
  });
  gsap.to(".route-card-glass__chip", {
    y: -8,
    rotate: 4,
    duration: 3.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    delay: 2.2,
  });

  // -----------------------------------------------------------
  // PARALLAX on aurora blobs (mouse-driven)
  // -----------------------------------------------------------
  const blobs = document.querySelectorAll(".aurora__blob");
  if (blobs.length && window.matchMedia("(pointer: fine)").matches) {
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    gsap.ticker.add(() => {
      currentX += (mouseX - currentX) * 0.05;
      currentY += (mouseY - currentY) * 0.05;
      blobs.forEach((blob, i) => {
        const depth = (i + 1) * 15;
        blob.style.translate = `${currentX * depth}px ${currentY * depth}px`;
      });
    });
  }

  // -----------------------------------------------------------
  // PARALLAX on hero visual (scroll-driven)
  // -----------------------------------------------------------
  gsap.to(".hero__visual", {
    y: -60,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
  });

  gsap.to(".hero__copy", {
    y: -30,
    opacity: 0.6,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
  });

  // -----------------------------------------------------------
  // SECTION REVEALS (scroll-triggered)
  // -----------------------------------------------------------
  const sectionFade = (selector, opts = {}) => {
    gsap.from(selector, {
      opacity: 0,
      y: 50,
      duration: 0.9,
      ease: "power3.out",
      stagger: opts.stagger || 0.1,
      scrollTrigger: {
        trigger: opts.trigger || selector,
        start: opts.start || "top 80%",
        toggleActions: "play none none none",
      },
    });
  };

  // Vibes section
  sectionFade(".vibes__head > *", { trigger: ".vibes__head", stagger: 0.12 });
  sectionFade(".vibe-card", { trigger: ".vibes__grid", stagger: 0.08, start: "top 85%" });

  // Features section
  sectionFade(".features__head > *", { trigger: ".features__head", stagger: 0.12 });
  sectionFade(".feature-card", { trigger: ".features__grid", stagger: 0.08, start: "top 85%" });

  // How section
  sectionFade(".how__head > *", { trigger: ".how__head", stagger: 0.12 });
  sectionFade(".how-step", { trigger: ".how__steps", stagger: 0.12, start: "top 85%" });

  // Final CTA
  gsap.from(".final-cta__card", {
    opacity: 0,
    y: 60,
    scale: 0.96,
    duration: 1.1,
    ease: "expo.out",
    scrollTrigger: {
      trigger: ".final-cta",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // -----------------------------------------------------------
  // VIBE CARD MAGNETIC HOVER
  // -----------------------------------------------------------
  document.querySelectorAll(".vibe-card, .feature-card").forEach((card) => {
    const emoji = card.querySelector(".vibe-card__emoji, .feature-card__icon");
    if (!emoji) return;

    card.addEventListener("mouseenter", () => {
      gsap.to(emoji, { scale: 1.15, rotate: -6, duration: 0.4, ease: "back.out(2)" });
    });
    card.addEventListener("mouseleave", () => {
      gsap.to(emoji, { scale: 1, rotate: 0, duration: 0.4, ease: "power2.out" });
    });
  });

  // -----------------------------------------------------------
  // ANIMATED ROUTE PATH on map card (continuous trace)
  // -----------------------------------------------------------
  const path = document.getElementById("route-path");
  if (path) {
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;
    gsap.to(path, {
      strokeDashoffset: 0,
      duration: 2.4,
      ease: "power2.inOut",
      delay: 1.4,
    });
  }

  // -----------------------------------------------------------
  // STAT NUMBER COUNTUP
  // -----------------------------------------------------------
  document.querySelectorAll(".hero__stat-num").forEach((el) => {
    const text = el.textContent.trim();
    const match = text.match(/^(\d+)(.*)$/);
    if (!match) return;
    const target = parseInt(match[1], 10);
    const suffix = match[2] || "";
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.6,
      ease: "power2.out",
      delay: 1.4,
      onUpdate: () => {
        el.textContent = Math.round(obj.val) + suffix;
      },
    });
  });

})();
