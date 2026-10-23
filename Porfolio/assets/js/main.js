/**
 * Bootstrap.
 *
 * Order matters: content is rendered first (so the page is readable without
 * WebGL), then Lenis + ScrollTrigger are wired, then the 3D scene is attached
 * last and only if WebGL is actually available.
 *
 * Classic script (not an ES module) so the page also works when index.html is
 * opened directly from disk, where module loading is blocked by CORS.
 */
(function () {
    'use strict';

    const { PROJECTS, NAV } = window.PortfolioData;
    const { PortfolioScene } = window;
    const {
        $,
        renderNav,
        renderHero,
        renderProfile,
        renderCredentials,
        renderSkills,
        renderContact,
        renderWork,
        initProjectModal,
        initCertificateLightbox,
        initContactForm,
        initTypewriter
    } = window.PortfolioUI;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    let lenis = null;
    let scene = null;
    let projectModal = null;
    let certificate = null;
    let typewriter = null;

    /** Renders all static content from data.js. */
    function renderContent(showThumbnails) {
        renderNav();
        renderHero();
        renderProfile();
        renderCredentials();
        renderSkills();
        renderContact();
        renderWork(showThumbnails);
    }

    /** True when the browser can give us a WebGL context. */

    /** True when the browser can give us a WebGL context. */
    function supportsWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return Boolean(
                window.WebGLRenderingContext &&
                    (canvas.getContext('webgl2') || canvas.getContext('webgl'))
            );
        } catch (error) {
            return false;
        }
    }

    /** Smooth scrolling. Lenis drives ScrollTrigger through a single event. */
    function initSmoothScroll() {
        if (reducedMotion || typeof window.Lenis !== 'function') return;

        lenis = new window.Lenis({
            duration: 1.15,
            // Exponential ease-out: fast pickup, long glide, no rubber-band.
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.6
        });

        // Lenis mutates scroll position, so ScrollTrigger must be told about it.
        lenis.on('scroll', window.ScrollTrigger.update);

        // Single rAF loop shared by Lenis, GSAP and the WebGL scene.
        const tick = (time) => lenis.raf(time * 1000);
        window.gsap.ticker.add(tick);
        window.gsap.ticker.lagSmoothing(0);
    }

    /** Scroll position → progress bar + nav active state. */
    function initScrollChrome() {
        const bar = $('#progress-bar');
        const topbar = $('#topbar');

        window.ScrollTrigger.create({
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: (self) => {
                if (bar) bar.style.transform = `scaleX(${self.progress})`;
            }
        });

        // Solidify the top bar once the hero starts leaving.
        window.ScrollTrigger.create({
            start: 'top -80',
            onUpdate: (self) => {
                if (topbar) topbar.classList.toggle('is-stuck', self.scroll() > 80);
            }
        });

        // Highlight the nav link for whichever section owns the viewport centre.
        NAV.forEach((item) => {
            const section = document.getElementById(item.id);
            if (!section) return;
            window.ScrollTrigger.create({
                trigger: section,
                start: 'top 55%',
                end: 'bottom 55%',
                onToggle: (self) => {
                    const link = document.querySelector(`[data-nav="${item.id}"]`);
                    if (link) link.classList.toggle('is-active', self.isActive);
                }
            });
        });
    }

    /**
     * Reveal-on-scroll for [data-reveal] elements and the skill bars.
     * Each target is revealed once, then unobserved.
     */
    function initReveals() {
        const targets = Array.from(document.querySelectorAll('[data-reveal]'));
        if (!targets.length) return;

        if (reducedMotion || typeof window.IntersectionObserver !== 'function') {
            window.gsap.set(targets, { opacity: 1, y: 0 });
            window.gsap.set('.skill__fill', { width: (i, el) => `${el.dataset.level}%` });
            return;
        }

        targets.forEach((element, index) => {
            window.gsap.to(element, {
                opacity: 1,
                y: 0,
                duration: 1,
                delay: (index % 3) * 0.08,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: element,
                    start: 'top 88%',
                    once: true
                }
            });
        });

        // Bars animate from 0 to their real level as the card scrolls in.
        document.querySelectorAll('.skill__fill').forEach((fill) => {
            window.gsap.to(fill, {
                width: `${fill.dataset.level}%`,
                duration: 1.6,
                ease: 'power3.out',
                scrollTrigger: { trigger: fill, start: 'top 92%', once: true }
            });
        });
    }

    /** Hero word-by-word intro. */
    function initHeroIntro() {
        const words = document.querySelectorAll('.hero__word');
        if (!words.length) return;

        if (reducedMotion) {
            window.gsap.set(words, { opacity: 1, y: 0 });
            return;
        }

        window.gsap.from(words, {
            yPercent: 110,
            opacity: 0,
            duration: 1.15,
            ease: 'power4.out',
            stagger: 0.075,
            delay: 0.15
        });
    }
    /**
     * Work section: ties ScrollTrigger progress to both the 3D scene and the
     * HTML detail cards.
     *
     * ScrollTrigger scrubs the section, which drives:
     *   - camera dolly + card tilt/zoom inside the WebGL scene
     *   - the active glass card, the 01/02 counter and the progress dots
     */
    function initWorkSection() {
        const section = document.getElementById('work');
        if (!section) return;

        const cards = Array.from(document.querySelectorAll('[data-work-card]'));
        const dots = Array.from(document.querySelectorAll('[data-dot]'));
        const counter = $('#work-counter');
        const total = PROJECTS.length;
        let activeIndex = -1;

        /** Swaps which glass card is visible and animates the transition. */
        function setActive(index) {
            if (index === activeIndex) return;
            activeIndex = index;

            cards.forEach((card, i) => {
                const isActive = i === index;
                card.classList.toggle('is-active', isActive);
                card.setAttribute('aria-hidden', String(!isActive));

                // CSS starts every card at opacity 0, so the fade must be driven
                // here rather than by a separate toggle handler, which would never
                // fire for the card that is already active on first render.
                window.gsap.to(card, {
                    autoAlpha: isActive ? 1 : 0,
                    y: isActive ? 0 : 18,
                    duration: reducedMotion ? 0 : 0.7,
                    ease: 'power3.out',
                    overwrite: 'auto'
                });
            });

            dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));

            if (counter) {
                counter.textContent =
                    `${String(index + 1).padStart(2, '0')} — ${String(total).padStart(2, '0')}`;
            }
        }

        // Show the first card immediately so the section is never blank.
        setActive(0);

        // Roughly one viewport-height of scroll per project keeps the pacing calm.
        const scrollDistance = () => window.innerHeight * total * 0.85;

        window.ScrollTrigger.create({
            trigger: section,
            start: 'top top',
            end: () => `+=${scrollDistance()}`,
            pin: '.work__overlay',
            pinSpacing: true,
            scrub: reducedMotion ? false : 0.8,
            onUpdate: (self) => {
                if (scene) scene.setScrollProgress(self.progress);

                // Map continuous progress onto the nearest card.
                const index = Math.min(total - 1, Math.round(self.progress * (total - 1)));
                setActive(index);
            }
        });

        // The 3D cards sit behind the text overlay, so they must only be visible
        // while this section is on screen; otherwise they bleed through the hero
        // and the other sections as a distracting ghost image.
        //
        // The window starts at 'top top' (not 'top bottom') to match the pin
        // trigger above. Skills sits directly above this section, so fading in
        // as soon as the section's top edge peeked into the viewport drew the
        // grey card planes straight over the skill matrix. Tying visibility to
        // the moment the overlay actually pins means the cards only appear once
        // Work owns the screen.
        window.ScrollTrigger.create({
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            onToggle: (self) => {
                if (scene) scene.setSectionVisible(self.isActive);
            }
        });

        // Card fades are handled entirely inside setActive(), so no per-card
        // ScrollTriggers are needed here.

        // Dot clicks jump to that project's scroll position.
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                const target =
                    window.scrollY + section.offsetTop + (scrollDistance() * index) / (total - 1);
                if (lenis) lenis.scrollTo(target, { duration: 1.4 });
                else window.scrollTo({ top: target, behavior: 'smooth' });
            });
        });
    }
    /** Buttons that open the project inspector and the certificate lightbox. */
    function initWorkActions() {
        document.addEventListener('click', (event) => {
            const inspect = event.target.closest('[data-inspect]');
            if (inspect && projectModal) {
                projectModal.open(Number(inspect.dataset.inspect));
                return;
            }

            const action = event.target.closest('[data-action]');
            if (action && action.dataset.action === 'certificate' && certificate) {
                certificate.open();
            }
        });
    }

    /** "View CV" opens the PDF resume in a new tab. */
    function initCvLinks() {
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-cv]');
            if (!trigger) return;
            event.preventDefault();
            window.open(trigger.dataset.cv, '_blank', 'noopener');
        });
    }

    /** Pause the render loop when the tab is hidden to save battery. */
    function initVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (!scene) return;
            if (document.hidden) scene.stop();
            else scene.start();
        });
    }

    /**
     * Minimum time the boot sequence stays up once initIntro() starts. Sized so
     * the full choreography plays: the name decodes over ~1.5s and the five log
     * lines scroll past at ~230ms each. The textures are inlined and normally
     * ready instantly, so without this floor the whole thing would flash past.
     */
    const MIN_SHOW_MS = 2200;

    /**
     * Resolves once every project texture has decoded, or after `timeoutMs`.
     * The intro waits on this so the reveal lines up with the real work rather
     * than an arbitrary sleep.
     */
    function whenSceneTexturesReady(timeoutMs) {
        return new Promise((resolve) => {
            if (!scene || !scene.cards.length) {
                resolve();
                return;
            }
            const deadline = performance.now() + timeoutMs;
            const poll = () => {
                if (scene.cards.every((card) => card.textureLoaded)) resolve();
                else if (performance.now() > deadline) resolve();
                else window.setTimeout(poll, 80);
            };
            poll();
        });
    }

    /** Lines shown in the boot log, mirroring what the page actually does. */
    const BOOT_LINES = [
        { label: 'INITIALISING WEBGL PIPELINE', status: 'OK' },
        { label: 'MOUNTING PROJECT TEXTURES', status: 'OK' },
        { label: 'COMPILING SHADERS', status: 'OK' },
        { label: 'CALIBRATING COMMAND CENTRE', status: 'OK' },
        { label: 'ESTABLISHING UPLINK', status: 'READY' }
    ];

    const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=';

    /**
     * Orbiting particle field behind the boot panel. Drawn on a 2D canvas so it
     * costs almost nothing and needs no WebGL context of its own.
     */
    function startBootCanvas(canvas) {
        if (!canvas || !canvas.getContext) return () => {};
        const ctx = canvas.getContext('2d');
        if (!ctx) return () => {};

        let width = 0;
        let height = 0;
        let frame = 0;
        let running = true;

        // Density scaled to area, capped so huge screens stay cheap.
        const COUNT = 70;
        const dots = Array.from({ length: COUNT }, (_, i) => ({
            angle: (Math.PI * 2 * i) / COUNT + Math.random() * 0.4,
            radius: 0.22 + Math.random() * 0.5,
            speed: 0.00016 + Math.random() * 0.00042,
            size: 0.6 + Math.random() * 1.5,
            tint: Math.random() > 0.72 ? '236, 72, 153' : '99, 102, 241'
        }));

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.max(1, Math.round(width * dpr));
            canvas.height = Math.max(1, Math.round(height * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = () => {
            if (!running) return;
            frame += 1;
            ctx.clearRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height / 2;
            const unit = Math.min(width, height);

            dots.forEach((dot) => {
                dot.angle += dot.speed * 16.67;

                // Elliptical orbit, gently breathing, centred on the panel.
                const breathe = 1 + Math.sin(frame * 0.012 + dot.angle) * 0.05;
                const x = cx + Math.cos(dot.angle) * unit * dot.radius * breathe;
                const y = cy + Math.sin(dot.angle) * unit * dot.radius * 0.62 * breathe;

                // Fade with distance from the core so the centre stays readable.
                const depth = (Math.sin(dot.angle) + 1) / 2;
                const alpha = 0.12 + depth * 0.4;

                ctx.beginPath();
                ctx.arc(x, y, dot.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${dot.tint}, ${alpha})`;
                ctx.fill();
            });

            requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        requestAnimationFrame(draw);

        return () => {
            running = false;
            window.removeEventListener('resize', resize);
        };
    }

    /** Resolves glyphs into `text` over `duration`, then leaves it readable. */
    function scrambleTo(element, text, duration) {
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }
            const started = performance.now();
            const tick = () => {
                const progress = Math.min(1, (performance.now() - started) / duration);
                // Characters lock in left-to-right, so it reads as decoding.
                const settled = Math.floor(progress * text.length);
                let output = '';
                for (let i = 0; i < text.length; i++) {
                    output +=
                        i < settled
                            ? text[i]
                            : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                }
                element.textContent = progress < 1 ? output : text;
                if (progress < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });
    }

    /** Reveals the boot log one line at a time. */
    function runBootLog(list) {
        if (!list) return Promise.resolve();
        return BOOT_LINES.reduce(
            (chain, line) =>
                chain.then(
                    () =>
                        new Promise((resolve) => {
                            const item = document.createElement('li');
                            item.className = 'is-done';
                            item.innerHTML = `<span>&gt; ${line.label}</span><span>${line.status}</span>`;
                            list.appendChild(item);
                            window.setTimeout(resolve, 230);
                        })
                ),
            Promise.resolve()
        );
    }

    /**
     * Boot sequence: holds the page while the content and the 3D textures come
     * up, then fades away. Plays a command-centre style startup - orbiting
     * particles, a decoding name and a scrolling log - then reveals the site.
     * Resolves once the site has been revealed.
     *
     * Deliberately written without GSAP: the overlay is the first thing a
     * visitor sees, so it must not depend on a CDN script being reachable. It
     * still runs if jsdelivr is blocked.
     *
     * The page underneath is only covered, never hidden, so anything that goes
     * wrong here can delay the reveal but can never leave the site blank.
     */
    function initIntro() {
        const intro = document.getElementById('intro-loader');
        if (!intro) {
            // init() locks up front; if there is no overlay, release immediately.
            document.body.classList.remove('is-locked');
            return Promise.resolve();
        }

        const fill = document.getElementById('intro-fill');
        const count = document.getElementById('intro-count');
        const phase = document.getElementById('boot-phase');
        const nameEl = document.getElementById('boot-name');
        const logEl = document.getElementById('boot-log');
        const announce = document.getElementById('intro-announce');

        let shown = 0;
        const setProgress = (value) => {
            // Monotonic: a late-arriving step must never rewind the readout.
            shown = Math.max(shown, Math.min(100, Math.round(value)));
            if (fill) fill.style.width = `${shown}%`;
            if (count) count.textContent = String(shown);
        };

        const stopCanvas = startBootCanvas(document.getElementById('boot-canvas'));

        const reveal = () => {
            stopCanvas();
            document.body.classList.remove('is-locked');
            if (announce) announce.textContent = 'Portfolio ready';
            intro.classList.add('is-done');
            // Leave the DOM once faded so it can never intercept clicks or focus.
            window.setTimeout(() => intro.remove(), 1000);
        };

        // Reduced motion: no orbit, no scramble, no timed sequence.
        if (reducedMotion) {
            if (nameEl) nameEl.textContent = 'NIRIJHON KENT DIAZ';
            setProgress(100);
            if (phase) phase.textContent = 'READY';
            reveal();
            return Promise.resolve();
        }

        const startedAt = performance.now();

        // Progress ramps on its own so the meter always moves, whatever the
        // network is doing. Real readiness still gates the reveal below.
        const ramp = window.setInterval(() => {
            const elapsed = performance.now() - startedAt;
            setProgress(Math.min(92, (elapsed / MIN_SHOW_MS) * 92));
        }, 60);

        // The name decodes into place while the log scrolls past.
        scrambleTo(nameEl, 'NIRIJHON KENT DIAZ', 1500);
        runBootLog(logEl).then(() => {
            if (phase) phase.textContent = 'UPLINK READY';
        });

        const ready = Promise.all([
            whenSceneTexturesReady(3000),
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        ]);

        // Belt and braces: reveal even if one of those never settles.
        const failsafe = new Promise((resolve) => window.setTimeout(resolve, 5000));

        return Promise.race([ready, failsafe])
            .then(
                () =>
                    // The textures are inlined, so they are usually ready almost
                    // immediately. Hold a minimum beat anyway, otherwise the
                    // sequence flashes past and reads as a glitch.
                    new Promise((resolve) =>
                        window.setTimeout(resolve, Math.max(0, MIN_SHOW_MS - (performance.now() - startedAt)))
                    )
            )
            .then(
                () =>
                    new Promise((resolve) => {
                        window.clearInterval(ramp);
                        if (phase) phase.textContent = 'READY';
                        const started = performance.now();
                        // Ease the last stretch so 100% lands deliberately.
                        const finish = () => {
                            const t = Math.min(1, (performance.now() - started) / 350);
                            setProgress(92 + (100 - 92) * (1 - Math.pow(1 - t, 3)));
                            if (t < 1) requestAnimationFrame(finish);
                            else resolve();
                        };
                        requestAnimationFrame(finish);
                    })
            )
            .then(() => {
                reveal();
                // The overlay had the scrollbar locked, so measurements taken
                // during boot can be a few pixels off.
                if (window.ScrollTrigger) window.ScrollTrigger.refresh();
            });
    }

    /* ==========================================================================
       Entry point
       ========================================================================== */

    function init() {
        // Marks that scripting is available, which enables the reveal styles.
        root.classList.add('js-ready');

        // The intro overlay owns the screen until boot finishes. Lock scrolling
        // from the very first frame rather than waiting for the scene to come
        // up, which takes ~1s; initIntro() always releases it again.
        if (document.getElementById('intro-loader')) document.body.classList.add('is-locked');

        // WebGL capability is checked first: if the scene cannot start, the work
        // cards must render their <img> thumbnails instead of hiding them.
        const canvas = document.getElementById('webgl-canvas');
        const canUseWebGL = supportsWebGL() && Boolean(canvas);
        if (!canUseWebGL) root.classList.add('no-webgl');

        renderContent(!canUseWebGL);

        if (window.gsap && window.ScrollTrigger) {
            window.gsap.registerPlugin(window.ScrollTrigger);
            initSmoothScroll();
            initScrollChrome();
            initHeroIntro();
            initReveals();

            // The pinned gallery exists to drive the WebGL planes. Without a canvas
            // there is nothing to scrub, and the swap logic would hide every card
            // except one via inline styles that override the .no-webgl CSS, so the
            // whole portfolio would appear empty. In that case every card stays
            // visible and simply stacks.
            if (canUseWebGL) initWorkSection();
        }

        projectModal = initProjectModal();
        certificate = initCertificateLightbox();
        initContactForm();
        initWorkActions();
        initCvLinks();

        // Only start typing once the hero is actually on screen.
        typewriter = initTypewriter();
        if (typewriter) {
            const hero = document.getElementById('intro');
            if (hero && 'IntersectionObserver' in window) {
                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                typewriter.start();
                                observer.disconnect();
                            }
                        });
                    },
                    { threshold: 0.3 }
                );
                observer.observe(hero);
            } else {
                typewriter.start();
            }
        }

        // Attach the scene last so it never delays first paint of the content.
        if (canUseWebGL) {
            try {
                scene = new PortfolioScene(canvas, PROJECTS, window.gsap);
                scene.start();
                // Exposed for diagnostics: lets us assert all textures resolved.
                window.__portfolioScene = scene;
            } catch (error) {
                // A failed context must never leave a blank hero.
                console.warn('WebGL scene unavailable, falling back to static layout.', error);
                root.classList.add('no-webgl');
                scene = null;
                renderWork(true); // swap in the <img> thumbnails
            }
        }

        initVisibilityHandling();

        // Reveal the site once everything above is wired. Runs last so the intro
        // can wait on the real scene textures rather than a fixed sleep.
        initIntro();

        // ScrollTrigger measured the document before fonts settled, which changes
        // section heights; refresh once loading is complete.
        window.addEventListener('load', () => {
            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                if (window.ScrollTrigger) window.ScrollTrigger.refresh();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
