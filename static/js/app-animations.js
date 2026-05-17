/* ============================================================
   MyVibe — App-wide subtle GSAP animations
   Runs on every non-landing page. Provides:
   - Soft entrance animations for the main content
   - Staggered reveal for glass cards
   - Mouse-driven parallax on aurora blobs
   - Hover lift on .route-card / .vibe-tile / .glass-card
   ============================================================ */
(function () {
  "use strict";

  if (typeof gsap === "undefined") {
    console.warn("GSAP not loaded; skipping app animations.");
    return;
  }

  // Landing page has its own animations file — bail.
  const page = document.body && document.body.getAttribute("data-page");
  if (page === "home") return;

  if (gsap.registerPlugin && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  // -----------------------------------------------------------
  // Header drop-in
  // -----------------------------------------------------------
  gsap.from(".app-header", {
    y: -20,
    opacity: 0,
    duration: 0.7,
    ease: "power3.out",
  });

  // -----------------------------------------------------------
  // Main content entrance — staggered
  // We target the page's <main> top-level sections / glass cards.
  // -----------------------------------------------------------
  const mainTargets = [
    "main > section",
    "main > div",
    ".glass-card",
    ".glass-soft",
    ".glass-strong",
  ];

  // De-duplicate so an element isn't animated twice.
  const seen = new Set();
  const toAnimate = [];
  mainTargets.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!seen.has(el)) {
        seen.add(el);
        toAnimate.push(el);
      }
    });
  });

  if (toAnimate.length) {
    gsap.from(toAnimate, {
      y: 24,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08,
      delay: 0.1,
      clearProps: "transform,opacity",
    });
  }

  // -----------------------------------------------------------
  // Aurora parallax (mouse-driven, fine pointer only)
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
      currentX += (mouseX - currentX) * 0.04;
      currentY += (mouseY - currentY) * 0.04;
      blobs.forEach((blob, i) => {
        const depth = (i + 1) * 10;
        blob.style.translate = `${currentX * depth}px ${currentY * depth}px`;
      });
    });
  }

  // -----------------------------------------------------------
  // Hover lift — only attach if not already provided by Tailwind hover
  // (Pure CSS handles the visual; this adds a touch of GSAP springiness on icons.)
  // -----------------------------------------------------------
  document.querySelectorAll(".route-card, .vibe-tile").forEach((card) => {
    card.addEventListener("mouseenter", () => {
      gsap.to(card, { y: -4, duration: 0.3, ease: "power2.out", overwrite: "auto" });
    });
    card.addEventListener("mouseleave", () => {
      gsap.to(card, { y: 0, duration: 0.4, ease: "power3.out", overwrite: "auto" });
    });
  });

  // -----------------------------------------------------------
  // Scroll-revealed elements (anything that opts in with [data-reveal])
  // -----------------------------------------------------------
  if (typeof ScrollTrigger !== "undefined") {
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });
  }
})();
})();
