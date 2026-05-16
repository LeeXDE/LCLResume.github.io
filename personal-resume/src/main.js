const yearEl = document.getElementById("year");

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const sections = document.querySelectorAll("#intro, #skills, #experience, #projects");
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.getAttribute("id") || "intro";
      document.querySelectorAll("#nav-menu a").forEach((link) => {
        const href = link.getAttribute("href");
        const match =
          (id === "intro" && href === "#intro") ||
          (id !== "intro" && href === `#${id}`);
        link.classList.toggle("is-active", match);
      });
    });
  },
  { rootMargin: "-35% 0px -55% 0px" }
);

sections.forEach((section) => sectionObserver.observe(section));

const revealTargets = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
);

revealTargets.forEach((el) => revealObserver.observe(el));

const heroPhoto = document.querySelector(".hero-photo");
const heroImg = document.querySelector(".hero-photo img");

if (heroPhoto && heroImg) {
  const markLoaded = () => {
    if (heroImg.naturalWidth > 0) {
      heroPhoto.classList.add("has-image");
    }
  };

  heroImg.addEventListener("load", markLoaded);
  heroImg.addEventListener("error", () => heroPhoto.classList.remove("has-image"));

  if (heroImg.complete) {
    markLoaded();
  }
}

const prototypeLightbox = document.getElementById("prototype-lightbox");
const prototypeLightboxImg = prototypeLightbox?.querySelector("img");
const prototypeLightboxClose = prototypeLightbox?.querySelector(".prototype-lightbox-close");

if (prototypeLightbox && prototypeLightboxImg) {
  const openLightbox = (button) => {
    const src =
      button.dataset.fullSrc || button.querySelector("img")?.getAttribute("src") || "";
    const alt = button.querySelector("img")?.getAttribute("alt") || "原型图";
    if (!src) return;
    prototypeLightboxImg.src = src;
    prototypeLightboxImg.alt = alt;
    prototypeLightbox.showModal();
  };

  document.querySelectorAll(".prototype-preview").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(btn));
  });

  prototypeLightboxClose?.addEventListener("click", () => {
    prototypeLightbox.close();
  });

  prototypeLightbox.addEventListener("click", (event) => {
    if (event.target === prototypeLightbox) {
      prototypeLightbox.close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && prototypeLightbox.open) {
      prototypeLightbox.close();
    }
  });
}

function syncWorksPrototypeHeight() {
  const layout = document.querySelector(".works-split-layout");
  const left = layout?.querySelector(".works-text-stack");
  if (!layout || !left) return;
  if (!window.matchMedia("(min-width: 768px)").matches) {
    layout.style.removeProperty("--works-text-h");
    return;
  }
  const h = left.getBoundingClientRect().height;
  layout.style.setProperty("--works-text-h", `${Math.ceil(h)}px`);
}

let syncWorksScheduled = false;
function scheduleSyncWorksPrototypeHeight() {
  if (syncWorksScheduled) return;
  syncWorksScheduled = true;
  requestAnimationFrame(() => {
    syncWorksScheduled = false;
    syncWorksPrototypeHeight();
  });
}

window.addEventListener("load", scheduleSyncWorksPrototypeHeight);
window.addEventListener("resize", scheduleSyncWorksPrototypeHeight);

const worksSplitLayout = document.querySelector(".works-split-layout");
const worksTextStack = worksSplitLayout?.querySelector(".works-text-stack");
if (worksTextStack) {
  const ro = new ResizeObserver(() => scheduleSyncWorksPrototypeHeight());
  ro.observe(worksTextStack);
}

if (worksSplitLayout) {
  worksSplitLayout.querySelectorAll("img").forEach((img) => {
    img.addEventListener("load", scheduleSyncWorksPrototypeHeight);
  });
}

const projectsReveal = document.querySelector("#projects .reveal");
if (projectsReveal) {
  const mo = new MutationObserver(() => {
    if (projectsReveal.classList.contains("is-visible")) {
      scheduleSyncWorksPrototypeHeight();
      window.setTimeout(scheduleSyncWorksPrototypeHeight, 450);
    }
  });
  mo.observe(projectsReveal, { attributes: true, attributeFilter: ["class"] });
}

scheduleSyncWorksPrototypeHeight();
