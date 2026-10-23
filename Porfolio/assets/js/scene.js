/**
 * Fixed-background WebGL scene.
 *
 * Uses the global THREE build (UMD) rather than an ES module import: ES
 * modules are blocked by CORS on file://, which is how this page is most often
 * opened for a quick preview.
 *
 * Colour management note: `outputColorSpace` / `texture.colorSpace` were only
 * introduced in three r152. This file targets the UMD build (r149), which uses
 * the older `encoding` properties — set below.
 */
(function () {
    'use strict';

    const THREE = window.THREE;

    if (!THREE) {
        // Leaves the page in its no-WebGL fallback rather than throwing.
        window.PortfolioScene = null;
        return;
    }
 /*
     * Owns three things:
     *  - a drifting particle field that gives the page depth while scrolling,
     *  - one plane mesh per project image (rendered as rounded, glowing "cards"),
     *  - a camera rig driven by GSAP/ScrollTrigger, plus mouse parallax.
     *
     * The renderer never touches the DOM layout: the HTML overlay is positioned on
     * top of the canvas and both are driven from the same scroll progress value.
     */

    const COLORS = {
    base: 0x0b0c10,
    indigo: 0x6366f1,
    pink: 0xec4899
};

// Card geometry is in world units; the camera rig is calibrated against these
// so a card fills roughly 60% of the viewport height.
const CARD_WIDTH = 4.6;
const CARD_GAP = 7.4;

/** Rounded-rectangle alpha mask, so plane edges are not hard 90-degree corners. */
function createRoundedMask(width, height, radius, resolution = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const r = (radius / width) * w;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/** Hermite ease used for the screen-space guard and other soft transitions. */
function smoothstep(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Loads an image for use as a texture.
 *
 * `encoding` matters: the project screenshots are sRGB, so without it they
 * render washed out compared to the <img> fallback in the HTML overlay.
 * Resolves to `null` on failure so the caller can degrade to a flat card
 * instead of throwing.
 */
function loadTexture(loader, url) {
    return new Promise((resolve) => {
        // Prefer the inlined copy from assets/js/textures.js. A `file://` image
        // counts as a tainted cross-origin resource for WebGL, so loading the
        // PNGs directly fails and the card stays an empty grey panel. A data
        // URI is same-origin by definition and can never taint, so it behaves
        // identically over file:// and over HTTP. Unlisted URLs (or a missing
        // textures.js) fall back to the original path.
        const source =
            (window.PORTFOLIO_TEXTURES && window.PORTFOLIO_TEXTURES[url]) || url;
        const isRemote = /^https?:\/\//i.test(source);
        loader.setCrossOrigin(isRemote ? 'anonymous' : undefined);
        loader.load(
            source,
            (texture) => {
                // three r149 uses the older `encoding` API (see header note).
                texture.encoding = THREE.sRGBEncoding;
                texture.anisotropy = 8;
                resolve(texture);
            },
            undefined,
            () => {
                // Logged rather than swallowed: this silent failure is exactly
                // what left every project card looking like a blank grey box.
                console.warn('[portfolio] texture failed to load:', url);
                resolve(null);
            }
        );
    });
}

    class PortfolioScene {
        constructor(canvas, projects, gsap) {
            this.canvas = canvas;
            this.projects = projects;
            this.gsap = gsap;
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // Continuous animation state, smoothed every frame.
            this.scrollProgress = 0;
            this.smoothProgress = 0;
            this.activeIndex = 0;
            this.pointer = new THREE.Vector2(0, 0);
            this.smoothPointer = new THREE.Vector2(0, 0);
            this.clock = new THREE.Clock();
            this.running = false;
            // Cards are hidden until the work section scrolls into view.
            this.sectionVisible = false;
            this.sectionFade = 0;
            this.planeDim = 1;
            // NDC X of the left edge of the HTML text column. Planes fading out
            // before this line never appear behind the copy.
            this.textGuard = -0.05;

            this.initRenderer();
            this.initScene();
            this.initParticles();
            this.initCards();
            this.initEvents();
        }

        initRenderer() {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            // Subtle tone mapping keeps the neon accents from clipping to white.
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.05;
        }

        initScene() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(COLORS.base);
            // Fog fades distant cards into the base color instead of hard-cutting.
            this.scene.fog = new THREE.FogExp2(COLORS.base, 0.055);

            this.camera = new THREE.PerspectiveCamera(
                45,
                window.innerWidth / window.innerHeight,
                0.1,
                100
            );
            this.camera.position.set(0, 0, 12);
            this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        }

        /** Slow-drifting dust field; sells the 3D depth while the page is static. */
        initParticles() {
            const count = 900;
            const positions = new Float32Array(count * 3);

            for (let i = 0; i < count; i += 1) {
                positions[i * 3] = (Math.random() - 0.5) * 34;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 4;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            this.particles = new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    color: COLORS.indigo,
                    size: 0.055,
                    transparent: true,
                    opacity: 0.5,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            this.scene.add(this.particles);
        }

    initCards() {
            this.loader = new THREE.TextureLoader();
            this.mask = createRoundedMask(CARD_WIDTH, CARD_WIDTH * 0.625, 0.34);
            this.cards = [];
            this.cardGroup = new THREE.Group();
            // The HTML overlay keeps its copy in the left column, so the 3D cards are
            // pushed into the free right half of the viewport on wide screens.
            // On narrow screens the text spans the full width and the card is
            // centred instead.
            this.layoutCards();
            this.scene.add(this.cardGroup);

            this.projects.forEach((project, index) => {
                const height = CARD_WIDTH / project.cardAspect;
                const accent = project.isPlaceholder ? COLORS.pink : COLORS.indigo;

                const group = new THREE.Group();
                group.position.x = (index - (this.projects.length - 1) / 2) * CARD_GAP;

                // Card body. The mask supplies the rounded alpha edge.
                const bodyMaterial = new THREE.MeshBasicMaterial({
                    color: 0x15171f,
                    alphaMap: this.mask,
                    transparent: true,
                    opacity: 1
                });
                const body = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, height), bodyMaterial);
                group.add(body);

                // Screenshot plane, inset to leave the mask's padding visible.
                const imageMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0
                });
                const image = new THREE.Mesh(
                    new THREE.PlaneGeometry(CARD_WIDTH - 0.24, height - 0.24),
                    imageMaterial
                );
                image.position.z = 0.01;
                group.add(image);

                // Additive glow slab behind the card for the neon edge bloom.
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: accent,
                    transparent: true,
                    opacity: 0.5,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const glow = new THREE.Mesh(
                    new THREE.PlaneGeometry(CARD_WIDTH + 0.7, height + 0.7),
                    glowMaterial
                );
                glow.position.z = -0.35;
                group.add(glow);

                this.cardGroup.add(group);
                this.cards.push({
                    group,
                    body,
                    image,
                    glow,
                    height,
                    accent,
                    // imageIntro ramps 0 → 1 once the bitmap arrives, so the
                    // screenshot can fade in without fighting the depth fade.
                    imageIntro: 0,
                    textureLoaded: false
                });

                loadTexture(this.loader, project.img).then((texture) => {
                    if (!texture) return;
                    // Placeholder stock shots were dimmed in the original UI; keep
                    // that, but only lightly so the photo stays legible.
                    imageMaterial.color.setScalar(project.isPlaceholder ? 0.8 : 1);
                    imageMaterial.map = texture;
                    imageMaterial.needsUpdate = true;
                    this.cards[index].textureLoaded = true;
                });
            });
        }

        initEvents() {
            this.onResize = this.onResize.bind(this);
            window.addEventListener('resize', this.onResize, { passive: true });

            this.onPointerMove = (event) => {
                this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
            };

            // Parallax is pointless (and distracting) under reduced motion.
            if (!this.reducedMotion) {
                window.addEventListener('pointermove', this.onPointerMove, { passive: true });
            }
        }

        /**
         * Chooses where the focused plane sits on screen.
         * On wide screens the text column owns the left half, so the plane is
         * pushed right by shifting the camera's aim point; on narrow screens the
         * text spans the full width, so the plane is centred.
         */
        layoutCards() {
            const narrow = window.innerWidth < 900;
            /* The focused plane is pushed right by shifting the camera's aim point.
               The value is tuned so the plane stays clear of the left text column
               across the whole scroll range; reducing it lets the plane drift
               under the copy and can leave no visible plane at all. */
            this.viewShift = narrow ? 0 : 3.2;
            /* On narrow layouts the copy spans the full width, so the plane sits
               directly behind the card and only its edges peek out. Dimming it
               turns that stray slice into an intentional ambient backdrop rather
               than a clipped fragment of a screenshot. */
            this.planeDim = narrow ? 0.3 : 1;
            // Narrow layouts stack the text over the full width, so there is no
            // free column to protect and no guard is applied.
            this.textGuard = narrow ? -2 : 0.05;
        }

        onResize() {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.layoutCards();
        }

        /** Called by ScrollTrigger on every scrub frame (0 → 1 across the page). */
        setScrollProgress(progress) {
            this.scrollProgress = THREE.MathUtils.clamp(progress, 0, 1);
            if (this.reducedMotion) this.smoothProgress = this.scrollProgress;
        }

        /**
         * Fades the card row in/out with the work section.
         * The canvas is a fixed layer behind the whole page, so without this the
         * project planes would be visible through the hero and other sections.
         */
        setSectionVisible(visible) {
            this.sectionVisible = visible;
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.clock.start();
            this.renderer.setAnimationLoop(() => this.tick());
        }

        stop() {
            this.running = false;
            this.renderer.setAnimationLoop(null);
        }
    /**
         * Card motion.
         *
         * The horizontal camera dolly comes from scroll progress; each card also
         * tilts away from centre and drops back in Z based on its distance from the
         * camera's focus point, which produces the depth-zoom transition.
         */
        updateCards(elapsed) {
            const total = this.projects.length;
            const focus = this.smoothProgress * (total - 1);
            this.activeIndex = Math.round(focus);

            this.cards.forEach((card, index) => {
                const distance = index - focus;
                const absolute = Math.abs(distance);
                const active = absolute < 0.5;

                // Scale down as a card leaves the focus point.
                card.group.scale.setScalar(THREE.MathUtils.clamp(1 - absolute * 0.16, 0.55, 1));

                // Push away in Z and tilt on Y to form a shallow arc / carousel.
                card.group.position.z = -absolute * 1.5;
                card.group.rotation.y = -distance * 0.42;
                card.group.rotation.x =
                    this.smoothPointer.y * -0.12 + Math.sin(elapsed * 0.6 + index) * 0.012;
                card.group.rotation.z = distance * 0.03;

                // The active card leans into the cursor; inactive cards stay flatter.
                card.group.rotation.y += this.smoothPointer.x * (active ? 0.22 : 0.06);
                card.group.position.y = this.smoothPointer.y * (active ? -0.28 : -0.08);

                // Fade distant cards so the stack reads as depth, not clutter.
                // Fade distant cards with a smooth cutoff: the text column occupies the
                // left half of the viewport, so a half-faded neighbour sitting
                // mid-transition would ghost behind the copy. Cards reach zero
                // opacity once they are more than ~0.45 steps from the focus.
                // sectionFade keeps the row invisible outside the work section.
                const falloff = Math.min(1, absolute / 0.75);
                let visibility = (1 - falloff * falloff) * this.sectionFade * this.planeDim;

                // Screen-space guard: the HTML overlay reserves the left column for
                // text, so a plane drifting into that region is faded out before
                // it can ghost behind the copy. The test uses the card's LEFT
                // EDGE (centre minus half its width), not its centre, so a wide
                // plane cannot clip the heading while still looking centred.
                const halfWidth =
                    Math.tan((this.camera.fov * Math.PI) / 360) *
                    this.camera.position.z *
                    this.camera.aspect;
                const halfCard = CARD_WIDTH / 2 / halfWidth; // card half-width in NDC
                const worldX = this.cardGroup.position.x + card.group.position.x;
                const leftEdge = (worldX - this.camera.position.x) / halfWidth - halfCard;
                // Fade to nothing before the card's left edge reaches the copy. The window
                // is deliberately narrow so a card is either clearly visible in
                // the free right column or already faded out, never a distracting
                // half-opacity sliver sitting over the heading.
                const guard = smoothstep(this.textGuard - 0.2, this.textGuard, leftEdge);
                visibility *= guard;
                card.body.material.opacity = visibility;
                card.glow.material.opacity = (0.22 + (active ? 0.55 : 0)) * visibility;

                // The screenshot fades in on load and is then modulated by the depth
                // fade. Driving opacity from both a tween and a per-frame
                // assignment made them fight, leaving the image stuck at 0.
                if (card.textureLoaded && card.imageIntro < 1) {
                    card.imageIntro = Math.min(1, card.imageIntro + 0.016);
                }
                card.image.material.opacity = visibility * card.imageIntro;
            });

            // Hide the row entirely when faded out so it is never clickable or
            // accidentally visible through other sections.
            this.cardGroup.visible = this.sectionFade > 0.01;
        }

        updateParticles(elapsed) {
            this.particles.rotation.y = this.smoothProgress * 0.6 + this.smoothPointer.x * 0.08;
            this.particles.rotation.x = this.smoothPointer.y * -0.05;
            this.particles.position.y = Math.sin(elapsed * 0.18) * 0.5 - this.smoothProgress * 4;
        }

        updateCamera(elapsed) {
            const total = this.projects.length;
            const focus = this.smoothProgress * (total - 1);

            // World X of the card the camera is currently centred on.
            const focusedX = (focus - (total - 1) / 2) * CARD_GAP;

            // Aiming at (focusedX - viewShift) keeps the focused plane a constant
            // distance to the right of the viewport centre, which is where the
            // text column leaves it free. The camera never yaws, so the card row
            // slides across the frame as a clean horizontal dolly.
            const aim = focusedX - this.viewShift;
            this.camera.position.x = aim;
            this.camera.position.y = -this.smoothPointer.y * 0.5;
            // Slow breathing zoom on top of the base camera distance.
            this.camera.position.z = 12 + Math.sin(elapsed * 0.35) * 0.35;
            this.camera.lookAt(aim, 0, 0);
        }

        dispose() {
            this.stop();
            window.removeEventListener('resize', this.onResize);
            if (this.onPointerMove) {
                window.removeEventListener('pointermove', this.onPointerMove);
            }
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) object.material.dispose();
            });
            this.renderer.dispose();
        }


        tick() {
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const elapsed = this.clock.elapsedTime;

            // Frame-rate independent damping for the scroll + pointer smoothing.
            this.smoothProgress +=
                (this.scrollProgress - this.smoothProgress) * (1 - Math.pow(0.001, dt));
            this.smoothPointer.x += (this.pointer.x - this.smoothPointer.x) * (1 - Math.pow(0.008, dt));
            this.smoothPointer.y += (this.pointer.y - this.smoothPointer.y) * (1 - Math.pow(0.008, dt));

            // Ease the whole card row in/out of view.
            const targetFade = this.sectionVisible ? 1 : 0;
            this.sectionFade += (targetFade - this.sectionFade) * (1 - Math.pow(0.004, dt));
            if (this.sectionFade < 0.002) this.sectionFade = 0;

            this.updateCards(elapsed);
            this.updateParticles(elapsed);
            this.updateCamera(elapsed);

            this.renderer.render(this.scene, this.camera);
        }
    }

    window.PortfolioScene = PortfolioScene;
})();
