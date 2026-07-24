// Track previous page for reliable "Go Back"
(function() {
    const current = window.location.href;
    const previous = sessionStorage.getItem("currentPage");

    if (previous !== current) {
        sessionStorage.setItem("previousPage", previous || "");
        sessionStorage.setItem("currentPage", current);
    }
})();

let scrollY = 0;

function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
}

function unlockScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    window.scrollTo(0, scrollY);

    // iOS Safari repaint nudge
    requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));

        // iOS Safari sometimes needs a delayed second pass
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
        }, 100);
    });
}
// The Modal for images
function openModal(imageSrc) {
    const imageModal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");
    if (!imageModal || !modalImage) return;

    lockScroll(); // ✅ ADD THIS

    imageModal.style.display = "block";
    modalImage.src = imageSrc;

    modalImage.onclick = () => {
        closeModal();
    };

    document.addEventListener("keydown", closeModalOnEscape);
}

function closeModalOnEscape(event) {
    if (event.key === "Escape") {
        closeModal();
    }
}

function closeModal() {
    const imageModal = document.getElementById("imageModal");
    if (imageModal) {
        imageModal.style.display = "none";
    }

    // Unlock scroll and remove ESC handler
    unlockScroll();
    document.removeEventListener("keydown", closeModalOnEscape);
}

// The Modal for iframe (video)
function openiframeModal(videoURL) {
    const iframeModal = document.getElementById("iframeModal");
    const iframe = document.getElementById("modaliframe");
    if (!iframeModal || !iframe) return;

    // Save where we are and lock background scroll
    lockScroll();

    // Show modal
    iframeModal.style.display = "block";

    // Set the iframe source with consistent parameters
    iframe.src = videoURL.includes("?") ? `${videoURL}&rel=0` : `${videoURL}?rel=0`;
    iframe.setAttribute("loading", "lazy"); // Add lazy loading

    // Close the modal when clicking on the iframe
    iframe.onclick = () => {
        closeiframeModal();
    };

    // Close the modal on 'Escape' key press
    document.addEventListener("keydown", closeiframeModalOnEscape);
}

function closeiframeModalOnEscape(event) {
    if (event.key === "Escape") {
        closeiframeModal();
    }
}

function closeiframeModal() {
    const iframeModal = document.getElementById("iframeModal");
    const iframe = document.getElementById("modaliframe");

    if (iframe) iframe.src = "";
    if (iframeModal) iframeModal.style.display = "none";

    unlockScroll();
    document.removeEventListener("keydown", closeiframeModalOnEscape);

    // Resume the autoplay video that opened the modal
    if (window.activeAutoplayVideo) {
        const activeVideo = window.activeAutoplayVideo;

        if (activeVideo.soundButton) {
            activeVideo.soundButton.style.display = "";
        }

        activeVideo.player.play().catch(() => {});
        window.activeAutoplayVideo = null;
    }
}
// END Modals===============================================

// Go back to previous page (search-safe)
function goBack() {
    const prev = sessionStorage.getItem("previousPage");

    if (prev && prev !== window.location.href) {
        window.location.href = prev;
    } else {
        window.location.href = "/";
    }

    return false;
}

// ===================================================
document.addEventListener("DOMContentLoaded", () => {

    /* -----------------------------------------
       SEARCH OVERLAY (Path 1)
       ----------------------------------------- */
    const searchTrigger = document.querySelector(".search-trigger");
    const searchOverlay = document.getElementById("search-overlay");

    if (searchTrigger && searchOverlay) {
        const searchInput = searchOverlay.querySelector("input");
        const searchForm = searchOverlay.querySelector("form");

        searchForm.addEventListener("keydown", (e) => {
            if (e.key === "Enter") e.stopPropagation();
        });

        searchTrigger.addEventListener("click", (e) => {
            e.preventDefault();
            sessionStorage.setItem("searchReferrer", window.location.href);
            lockScroll();
            searchOverlay.classList.add("active");
            if (searchInput) searchInput.focus();
        });

        searchOverlay.addEventListener("click", (e) => {
            if (e.target === searchOverlay) {
                if (searchInput) searchInput.blur();
                searchOverlay.classList.remove("active");
                unlockScroll();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (searchInput) searchInput.blur();
                searchOverlay.classList.remove("active");
                unlockScroll();
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchOverlay.classList.add("active");
                if (searchInput) searchInput.focus();
            }
        });
    }

    // Smooth scrolling — native scrollIntoView
    const linksWithHash = document.querySelectorAll('a[href*="#"]');

    linksWithHash.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;

        const url = new URL(href, window.location.href);

        if (
            url.pathname !== window.location.pathname ||
            url.hostname !== window.location.hostname ||
            !url.hash ||
            url.hash.length <= 1
        ) {
            return;
        }

        const target = document.querySelector(url.hash);
        if (!target) return;

        link.addEventListener("click", (event) => {
            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            history.pushState(null, "", url.hash);
        });
    });

    // Opacity effect — only on devices with true hover support
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const getSiblingImage = ($el) => {
            let $img = $el.siblings("picture").find("img");
            if (!$img.length) $img = $el.siblings("img");
            return $img;
        };

        const applyHoverEffect = (selector) => {
            $(selector).css({
                opacity: 0
            });
            $(selector).hover(
                function() {
                    const $img = getSiblingImage($(this));
                    $(this).stop().animate({
                        opacity: 1
                    }, 1000, "swing"); // fade the icon in over 1000ms 
                    $img.stop().animate({
                        opacity: 0.5
                    }, 600, "swing"); // fade the image down over 600ms
                },
                function() {
                    const $img = getSiblingImage($(this));
                    $(this).stop().animate({
                        opacity: 0
                    }, 400, "linear"); //fade the icon out over 400ms
                    $img.stop().animate({
                        opacity: 1
                    }, 500, "linear"); //fade the image back to full opacity over 500ms
                }
            );
        };

        applyHoverEffect(".zoom");
        applyHoverEffect(".play");
    }

    // slideshow
    document.querySelectorAll(".slideshow").forEach((slideshow) => {
        const slides = slideshow.querySelectorAll("img");
        if (slides.length < 2) return;

        let i = 0;
        const delay = +slideshow.dataset.delay || 5000;
        slides[0].classList.add("is-active");

        setInterval(() => {
            slides[i].classList.remove("is-active");
            i = (i + 1) % slides.length;
            slides[i].classList.add("is-active");
        }, delay);
    });
});

/* ====================================================
   MOBILE HAMBURGER MENU (mq3)
   ==================================================== */
(() => {
    const toggle = document.getElementById("nav-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;

    const openNav = () => {
        document.body.classList.add("nav-open");
        toggle.setAttribute("aria-expanded", "true");
    };

    const closeNav = () => {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
    };

    const toggleNav = () => {
        if (document.body.classList.contains("nav-open")) {
            closeNav();
        } else {
            openNav();
        }
    };

    // Open/close on button tap
    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleNav();
    });

    // Close when tapping a link
    mobileNav.addEventListener("click", (e) => {
        if (e.target.tagName === "A") {
            closeNav();
        }
    });

    // Close when tapping outside
    document.addEventListener("click", (e) => {
        if (!document.body.classList.contains("nav-open")) return;
        if (mobileNav.contains(e.target) || toggle.contains(e.target)) return;
        closeNav();
    });

    // Close with Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeNav();
    });
})();

/* ===================================================
   AUTOPLAY VIMEO VIDEOS
   Reusable on any page
   =================================================== */

const autoplayVideos = [];
	document.querySelectorAll(".autoplay-video").forEach((videoContainer) => {
    const iframe = videoContainer.querySelector(".autoplay-video-frame");

    if (!iframe || !window.Vimeo) return;

    const player = new Vimeo.Player(iframe);
    player.ready().then(() => {
    console.log("READY");
});

player.on("play", () => {
    console.log("PLAY");
    videoContainer.classList.add("video-ready");
});

player.on("playing", () => {
    console.log("PLAYING");
});

player.on("error", (e) => {
    console.log("VIMEO ERROR", e);
});
    const soundButton = videoContainer.querySelector(
        ".autoplay-video-sound"
    );
    const overlay = videoContainer.querySelector(
        ".autoplay-video-overlay"
    );
    const modalURL = videoContainer.dataset.modalUrl || "";

    const videoInstance = {
        player: player,
        soundButton: soundButton,
        volumeBeforeHide: 0,
        wasPlayingBeforeHide: false
    };

    autoplayVideos.push(videoInstance);

    // Make the first video available to older site functions if needed
    if (!window.heroPlayer) {
        window.heroPlayer = player;
    }

    // Start muted for Safari autoplay
    player.setVolume(0).catch(() => {});

    // Sound toggle
    if (soundButton) {
        soundButton.addEventListener("click", async() => {
            try {
                const volume = await player.getVolume();

                if (volume === 0) {
                    await player.setVolume(0.6);
                    soundButton.textContent = "🔇 Sound Off";
                } else {
                    await player.setVolume(0);
                    soundButton.textContent = "🔊 Sound On";
                }
            } catch (error) {}
        });
    }

    // Pause autoplay video and open its full video modal
    if (overlay && modalURL) {
        overlay.addEventListener("click", () => {
            player.pause().catch(() => {});

            window.activeAutoplayVideo = videoInstance;

            if (soundButton) {
                soundButton.style.display = "none";
            }

            openiframeModal(modalURL);
        });
    }
});

// Pause hidden videos and resume them when the tab becomes visible
document.addEventListener("visibilitychange", async() => {
    for (const video of autoplayVideos) {
        try {
            if (document.hidden) {
                video.volumeBeforeHide = await video.player.getVolume();
                video.wasPlayingBeforeHide = !(await video.player.getPaused());

                if (video.wasPlayingBeforeHide) {
                    await video.player.pause();
                }
            } else if (video.wasPlayingBeforeHide) {
                // Resume muted first so Safari permits automatic playback
                await video.player.setVolume(0);
                await video.player.play();

                // Restore sound if it was previously on
                if (video.volumeBeforeHide > 0) {
                    await video.player.setVolume(video.volumeBeforeHide);
                }

                video.wasPlayingBeforeHide = false;
            }
        } catch (error) {}
    }
});

// Pause all autoplay videos when Safari caches or unloads the page
window.addEventListener("pagehide", () => {
    autoplayVideos.forEach((video) => {
        video.player.pause().catch(() => {});
    });
});

// Service Worker: register on all pages that load this script
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                console.log("Service Worker registered with scope:", registration.scope);
            })
            .catch((error) => {
                console.log("Service Worker registration failed:", error);
            });
    });
}