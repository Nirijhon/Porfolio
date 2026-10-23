/**
 * DOM layer: renders all content from data.js and owns every overlay
 * interaction (project inspector, certificate lightbox, contact form).
 *
 * The WebGL scene never renders text, so everything here is also the
 * no-JS / no-WebGL accessible version of the same content.
 *
 * Classic script (not an ES module) so the page also works over file://,
 * where module loading is blocked by CORS.
 */
(function () {
    'use strict';

    const {
        PROFILE,
        CREDENTIALS,
        SKILL_GROUPS,
        PROJECTS,
        RECEIPT,
        CERTIFICATE,
        CONTACT,
        NAV
    } = window.PortfolioData;

    /**
     * DOM layer: renders all content from data.js and owns every overlay
     * interaction (project inspector, certificate lightbox, contact form).
     *
     * The WebGL scene never renders text, so everything here is also the
     * no-JS / no-WebGL accessible version of the same content.
     */

    /* Minimal inline icon set (replaces the previous Font Awesome dependency). */
    const ICONS = {
        award: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/>',
        graduation: '<path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>',
        shield: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
        certificate:
            '<path d="M12 2L1 9l11 6 9-4.91V17h2V9L12 2zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>',
        server:
            '<path d="M4 1h16a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2zm0 2v5h16V3H4zm2 1.5h2v2H6V4.5zM4 11h16a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5a2 2 0 012-2zm0 2v5h16v-5H4zm2 1.5h2v2H6v-2z"/>',
        code: '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
        check: '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>',
        pin: '<path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/>',
        mail: '<path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
        phone:
            '<path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.58 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.6a1 1 0 01-.25 1l-2.2 2.2z"/>',
        cctv:
            '<path d="M4 6h10a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm14 2.5l3.5-1.5v6l-3.5-1.5v-3zM4 16h10v2H4v-2z"/>',
        file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
        arrow: '<path d="M6 17.6L16.6 7 14.6 5 4 15.6 6 17.6zM8.5 19H19v-2H8.5v2z"/>',
        close: '<path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z"/>',
        print: '<path d="M19 8H5a3 3 0 00-3 3v6h4v4h12v-4h4v-6a3 3 0 00-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 110-2 1 1 0 010 2zm-1-9H6v4h12V3z"/>',
        plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/>',
        minus: '<path d="M5 11h14v2H5v-2z"/>'
    };

    /**
     * Builds an accessible inline SVG from the icon table.
     * ICONS entries are complete <path> elements, so they are emitted as-is.
     */
    function icon(name, className = '') {
        const path = ICONS[name];
        if (!path) return '';
        return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"${
            className ? ` class="${className}"` : ''
        }>${path}</svg>`;
    }

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    /** Zero-padded index for the large 01 / 02 / 03 / 04 section numbering. */
    const pad = (index) => String(index + 1).padStart(2, '0');
    /* ==========================================================================
       Renderers
       ========================================================================== */

    /** Top bar navigation. */
    function renderNav() {
        const nav = $('#nav-links');
        if (!nav) return;
        nav.innerHTML = NAV.map(
            (item) => `<a href="#${item.id}" data-nav="${item.id}">${item.label}</a>`
        ).join('');
    }

    /** Hero: name, role, objective, metrics. */
    function renderHero() {
        const role = $('#hero-role');
        if (role) role.textContent = PROFILE.role;

        const title = $('#hero-title');
        if (title) {
            // Split the name so each word can animate in independently.
            title.innerHTML = PROFILE.name
                .split(' ')
                .map((word) => `<span class="hero__word">${word}</span>`)
                .join(' ');
        }

        const objective = $('#hero-objective');
        if (objective) objective.textContent = PROFILE.objective;

        const metrics = $('#metrics');
        if (metrics) {
            metrics.innerHTML = PROFILE.metrics
                .map(
                    (metric) => `
                <div class="metric">
                    <div class="mono">${metric.label}</div>
                    <div class="metric__value${metric.accent === 'accent' ? ' metric__value--accent' : ''}${metric.accent === 'pink' ? ' metric__value--pink' : ''}">${metric.value}</div>
                    <div class="metric__note">${metric.note}</div>
                </div>`
                )
                .join('');
        }
    }

    /** Profile card: avatar (with local upload preview), badges, contact links. */
    function renderProfile() {
        const avatar = $('#avatar-img');
        if (avatar) {
            avatar.src = PROFILE.avatar;
            avatar.alt = PROFILE.avatarAlt;
        }

        const badges = $('#badge-list');
        if (badges) {
            badges.innerHTML = PROFILE.badges
                .map((badge) => `<li class="badge">${icon(badge.icon)}<span>${badge.text}</span></li>`)
                .join('');
        }

        const contacts = $('#contact-list');
        if (contacts) {
            contacts.innerHTML = `
                <a href="mailto:${PROFILE.email}">${icon('mail')}<span>${PROFILE.email}</span></a>
                <a href="${PROFILE.phoneHref}">${icon('phone')}<span>${PROFILE.phone}</span></a>`;
        }

        initAvatarUpload();
    }

    /** Client-side photo preview for the profile card. */
    function initAvatarUpload() {
        const input = $('#avatar-upload');
        const image = $('#avatar-img');
        if (!input || !image) return;

        input.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (result) => {
                image.src = result.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    /** Credentials / education cards. */
    function renderCredentials() {
        const grid = $('#credential-grid');
        if (!grid) return;

        grid.innerHTML = CREDENTIALS.map((item, index) => {
            const accent = index === 0 ? 'accent' : 'pink';
            const action = item.action
                ? `<button class="btn btn--ghost" data-action="${item.action.kind}">
                       ${icon(item.action.kind === 'certificate' ? 'certificate' : 'file')}
                       <span>${item.action.label}</span>
                   </button>`
                : '';
            const link = item.link
                ? `<a class="credential__link" href="${item.link.href}" target="_blank" rel="noopener noreferrer">
                       ${icon('pin')}<span>${item.link.label}</span>${icon('arrow')}
                   </a>`
                : '';
            // Footer strings are "Label: Value" pairs, so the value is emphasised.
            const footer = item.footer
                .map((line) => {
                    const [label, ...rest] = line.split(':');
                    return `<span>${label}: <strong>${rest.join(':').trim()}</strong></span>`;
                })
                .join('');

            return `
            <article class="glass glass--hover glow-border credential" data-reveal>
                <div class="credential__head">
                    <span class="credential__tag credential__tag--${accent}">${item.tag}</span>
                    ${icon(item.icon, 'credential__icon')}
                </div>
                <div>
                    <h3 class="headline" style="font-size:clamp(1.25rem,2.4vw,1.65rem)">${item.title}</h3>
                    <div class="credential__meta">${item.meta}</div>
                </div>
                <p class="credential__body">${item.body}</p>
                ${action}
                ${link}
                <div class="credential__footer">${footer}</div>
            </article>`;
        }).join('');
    }

    /** Skills matrix with animated proficiency bars. */
    function renderSkills() {
        const grid = $('#skill-grid');
        if (!grid) return;

        grid.innerHTML = SKILL_GROUPS.map(
            (group, index) => `
            <article class="glass glass--hover skill-group${index === 1 ? ' skill-group--pink' : ''}" data-reveal>
                <h3 class="skill-group__title">${icon(group.icon)}<span>${group.title}</span></h3>
                <div class="skill-list">
                    ${group.skills
                        .map(
                            (skill) => `
                        <div class="skill">
                            <div class="skill__row">
                                <span class="skill__name">${skill.name}</span>
                                <span class="skill__value">${skill.level}%</span>
                            </div>
                            <div class="skill__track">
                                <div class="skill__fill" data-level="${skill.level}"></div>
                            </div>
                        </div>`
                        )
                        .join('')}
                </div>
            </article>`
        ).join('');
    }

    /** Contact section + form copy. */
    function renderContact() {
        const title = $('#contact-title');
        if (title) title.textContent = CONTACT.title;

        const eyebrow = $('#contact-eyebrow');
        if (eyebrow) eyebrow.textContent = CONTACT.eyebrow;

        const body = $('#contact-body');
        if (body) body.textContent = CONTACT.body;

        const success = $('#form-success');
        if (success) success.textContent = CONTACT.success;
    }

    /**
     * Work stage: one glass detail card per project plus the 01-style index.
     * The card <img> is only revealed in the no-WebGL fallback.
     */
    function renderWork(showThumbnails = false) {
        const cards = $('#work-cards');
        const dots = $('#work-dots');
        if (!cards) return;

        cards.innerHTML = PROJECTS.map((project, index) => {
            const pink = project.isPlaceholder;
            return `
            <article class="glass glass--hover work-card${pink ? ' work-card--pink' : ''}" data-work-card="${index}" aria-hidden="true">
                <img class="work-card__thumb" src="${project.img}" alt="${project.imgAlt}" loading="lazy"${showThumbnails ? '' : ' hidden'}>
                <div class="work-card__head">
                    <span class="work-card__index">${pad(index)} / ${pad(PROJECTS.length - 1)}</span>
                    <span class="work-card__pill">${project.category}</span>
                </div>
                <h3 class="headline" style="font-size:clamp(1.35rem,2.6vw,2rem)">${project.displayTitle}</h3>
                <p class="work-card__body">${project.desc}</p>
                <ul class="feature-list">
                    ${project.features.map((feature) => `<li>${icon('check')}<span>${feature}</span></li>`).join('')}
                </ul>
                <div class="work-card__foot">
                    <div class="tag-row">${project.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
                    <button class="btn btn--ghost work-card__cta" data-inspect="${index}">
                        ${icon('arrow')}<span>Inspect Project</span>
                    </button>
                </div>
            </article>`;
        }).join('');

        if (dots) {
            dots.innerHTML = PROJECTS.map(
                (project, index) =>
                    `<button class="work__dot" data-dot="${index}" aria-label="Go to project ${index + 1}"></button>`
            ).join('');
        }
    }
    /* ==========================================================================
       Overlays: project inspector, certificate lightbox, receipt, form
       ========================================================================== */

    /** 80mm thermal receipt markup, reused by the print stylesheet. */
    function receiptMarkup() {
        return `
        <div class="receipt">
            <div class="receipt__label">
                <span>${icon('print')} Thermal Receipt Snippet Demo</span>
                <span>80mm Format</span>
            </div>
            <div class="receipt__paper" id="printable-receipt">
                <div class="receipt__head">
                    <div class="receipt__business">${RECEIPT.business}</div>
                    <div class="receipt__sub">${RECEIPT.subtitle}</div>
                </div>
                <div class="receipt__meta">
                    <span>RCPT #: ${RECEIPT.number}</span>
                    <span>DATE: ${RECEIPT.date}</span>
                </div>
                <div class="receipt__items">
                    ${RECEIPT.lines
                        .map(
                            (line) =>
                                `<div class="receipt__item"><span>${line.label}</span><span>${line.amount}</span></div>`
                        )
                        .join('')}
                </div>
                <div class="receipt__total"><span>TOTAL AMOUNT:</span><span>${RECEIPT.total}</span></div>
                <div class="receipt__thanks">${RECEIPT.footer}</div>
            </div>
            <button class="btn btn--primary receipt__print" data-print>${icon('print')}<span>Print Thermal Receipt</span></button>
        </div>`;
    }

    /**
     * Modal plumbing shared by both overlays.
     * Locks body scroll, closes on backdrop click and on Escape.
     */
    function createOverlay(modalId, onClose) {
        const modal = document.getElementById(modalId);
        if (!modal) return null;

        const close = () => {
            modal.classList.remove('is-open');
            document.body.classList.remove('is-locked');
            if (onClose) onClose();
        };

        const open = () => {
            modal.classList.add('is-open');
            document.body.classList.add('is-locked');
            const panel = $('.modal__panel', modal);
            if (panel) panel.scrollTop = 0;
        };

        modal.addEventListener('click', (event) => {
            // Only a click on the backdrop itself dismisses, not the panel content.
            if (event.target === modal) close();
        });

        $$('[data-close-modal]', modal).forEach((button) => {
            button.addEventListener('click', close);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
        });

        return { modal, open, close };
    }

    /** Project inspector. */
    function initProjectModal() {
        const overlay = createOverlay('project-modal');
        if (!overlay) return null;

        const image = $('#modal-img');
        const title = $('#modal-title');
        const desc = $('#modal-desc');
        const category = $('#modal-category');
        const features = $('#modal-features');
        const receiptSlot = $('#modal-receipt-slot');

        // Print is delegated so it works for the receipt injected on open.
        document.addEventListener('click', (event) => {
            if (event.target.closest('[data-print]')) window.print();
        });

        return {
            open(index) {
                const project = PROJECTS[index];
                if (!project) return;

                image.src = project.img;
                image.alt = project.imgAlt;
                title.textContent = project.title;
                desc.textContent = project.desc;
                category.textContent = project.category;
                features.innerHTML = project.features
                    .map((feature) => `<li>${icon('check')}<span>${feature}</span></li>`)
                    .join('');

                // Only the expense tool ships the printable receipt demo.
                receiptSlot.innerHTML = project.hasReceipt ? receiptMarkup() : '';
                overlay.open();
            }
        };
    }
    /** TESDA certificate lightbox with zoom. */
    function initCertificateLightbox() {
        const overlay = createOverlay('cert-modal');
        if (!overlay) return null;

        const image = $('#cert-img');
        const zoomLabel = $('#cert-zoom-label');
        const scrollArea = $('#cert-scroll-area');
        const fullSize = $('#cert-fullsize');
        let scale = 1;

        image.src = CERTIFICATE.file;
        image.alt = CERTIFICATE.alt;
        if (fullSize) fullSize.href = CERTIFICATE.file;

        // Largest scale (<= 100%) that still shows the whole certificate.
        function fitScale() {
            const available = scrollArea.clientHeight - 40; // allow for padding
            if (available <= 0) return 1;
            return Math.min(1, available / CERTIFICATE.naturalHeight);
        }

        function applyZoom() {
            scale = Math.min(CERTIFICATE.maxScale, Math.max(CERTIFICATE.minScale, scale));
            zoomLabel.textContent = Math.round(scale * 100) + '%';
            image.style.width = Math.round(CERTIFICATE.naturalWidth * scale) + 'px';
            image.style.maxWidth = 'none';
        }

        function resetZoom() {
            scale = fitScale();
            applyZoom();
            scrollArea.scrollTop = 0;
            scrollArea.scrollLeft = 0;
        }

        // Ctrl/Cmd + wheel zooms the certificate like a normal image viewer.
        scrollArea.addEventListener(
            'wheel',
            (event) => {
                if (!event.ctrlKey) return;
                event.preventDefault();
                scale += event.deltaY < 0 ? 0.15 : -0.15;
                applyZoom();
            },
            { passive: false }
        );

        const controller = {
            open() {
                // Refit once the bitmap arrives, since the first paint is blank.
                if (!image.complete) image.addEventListener('load', resetZoom, { once: true });
                overlay.open();
                // The panel must be visible before measuring, or clientHeight is 0.
                resetZoom();
            },
            zoom(step) {
                scale += step;
                applyZoom();
            },
            reset: resetZoom
        };

        // Toolbar buttons, including the "100%" label which re-fits the image.
        $$('[data-cert]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.cert === 'in') controller.zoom(0.25);
                else if (button.dataset.cert === 'out') controller.zoom(-0.25);
                else controller.reset();
            });
        });

        return controller;
    }

    /** Contact form: simulated submit, matching the previous behaviour. */
    function initContactForm() {
        const form = $('#contact-form');
        const success = $('#form-success');
        if (!form || !success) return;

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            success.classList.remove('is-hidden');
            form.reset();
        });
    }

    /** Career objective typewriter (respects reduced motion). */
    function initTypewriter() {
        const element = $('#hero-objective');
        if (!element) return null;

        const fullText = element.textContent.replace(/\s+/g, ' ').trim();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

        let index = 0;
        let timer = null;
        let finished = false;

        function finish() {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            element.textContent = fullText;
            element.classList.remove('caret');
        }

        function typeNext() {
            if (finished) return;
            // A few characters per tick so the long objective is not too slow.
            index += 2;
            element.textContent = fullText.slice(0, index);
            if (index >= fullText.length) {
                finish();
                return;
            }
            timer = setTimeout(typeNext, 18);
        }

        function start() {
            if (finished || index > 0) return;
            element.classList.add('caret');
            // Reserve height so the layout does not jump while typing.
            element.style.minHeight = element.offsetHeight + 'px';
            element.textContent = '';
            timer = setTimeout(typeNext, 400); // small lead-in pause
        }

        element.addEventListener('click', finish);
        return { start, finish };
    }

    window.PortfolioUI = {
        $,
        $$,
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
    };
})();
