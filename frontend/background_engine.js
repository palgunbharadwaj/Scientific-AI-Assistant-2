/**
 * Scientific Assistant - Dynamic DNA Helix Engine (Three.js)
 * Implements a rotating double helix that unravels into data points as you scroll.
 */

const ScientificBGs = (function () {
    let scene, camera, renderer, clock;
    let helixGroup;
    let strandPoints = []; // To store original positions for unraveling
    let currentTheme = 'dark';
    let scrollPos = 0;

    const THEME_COLORS = {
        'dark': { color: 0x6b4cff, fog: 0x050508, particleSize: 3.0, opacity: 1.0 },
        'light': { color: 0x2563eb, fog: 0xf8fafc, particleSize: 3.5, opacity: 1.0 },
        'doctor': { color: 0x10b981, fog: 0x020805, particleSize: 3.0, opacity: 1.0 },
        'researcher': { color: 0xf59e0b, fog: 0x080502, particleSize: 3.0, opacity: 1.0 },
        'admin': { color: 0xffae00, fog: 0x030205, particleSize: 3.0, opacity: 1.0 }
    };

    function init() {
        const container = document.getElementById('unified-bg-canvas');
        if (!container) return;

        scene = new THREE.Scene();
        clock = new THREE.Clock();

        const config = THEME_COLORS[currentTheme] || THEME_COLORS['dark'];

        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 3000);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        createDNA(config);

        // Scroll listener
        const scrollElement = document.getElementById('main-scroll-view');
        if (scrollElement) {
            scrollElement.addEventListener('scroll', () => {
                const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
                scrollPos = scrollElement.scrollTop / maxScroll;
            });
        }

        animate();
        window.addEventListener('resize', onWindowResize);
    }

    function createDNA(config) {
        helixGroup = new THREE.Group();
        scene.add(helixGroup);

        const pointsA = [], pointsB = [], rungs = [];
        const height = 500;
        const radius = 50; // Doubled radius for visibility
        const turns = 10;
        const detail = 1000;

        // Generate parametric Helix
        for (let i = 0; i < detail; i++) {
            const t = (i / detail) * Math.PI * 2 * turns;
            const y = (i / detail) * height - (height / 2);

            // Strand A
            const xA = Math.cos(t) * radius;
            const zA = Math.sin(t) * radius;
            pointsA.push(new THREE.Vector3(xA, y, zA));

            // Strand B (offset by PI)
            const xB = Math.cos(t + Math.PI) * radius;
            const zB = Math.sin(t + Math.PI) * radius;
            pointsB.push(new THREE.Vector3(xB, y, zB));

            // Base Pair Rungs (every N points)
            if (i % 15 === 0) {
                rungs.push(new THREE.Vector3(xA, y, zA));
                rungs.push(new THREE.Vector3(xB, y, zB));
            }
        }

        // Create Strand A Geometry
        const geoA = new THREE.BufferGeometry().setFromPoints(pointsA);
        const matA = new THREE.PointsMaterial({ color: config.color, size: config.particleSize, transparent: true, opacity: config.opacity });
        const cloudA = new THREE.Points(geoA, matA);
        helixGroup.add(cloudA);

        // Create Strand B Geometry
        const geoB = new THREE.BufferGeometry().setFromPoints(pointsB);
        const matB = new THREE.PointsMaterial({ color: config.color, size: config.particleSize, transparent: true, opacity: config.opacity });
        const cloudB = new THREE.Points(geoB, matB);
        helixGroup.add(cloudB);

        // Create Rungs Geometry
        const geoRungs = new THREE.BufferGeometry().setFromPoints(rungs);
        const matRungs = new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: config.opacity * 0.4 });
        const cloudRungs = new THREE.LineSegments(geoRungs, matRungs);
        helixGroup.add(cloudRungs);

        // Store references for animation
        strandPoints = [
            { obj: cloudA, original: pointsA.map(p => p.clone()) },
            { obj: cloudB, original: pointsB.map(p => p.clone()) },
            { obj: cloudRungs, original: rungs.map(p => p.clone()) }
        ];

        camera.position.z = 250; // Move it back to see the whole helix
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        // 1. Gentle Rotation
        helixGroup.rotation.y = time * 0.2;

        // 2. Unraveling Interactivity
        // Map scrollPos to unravel intensity (starts near 0.2 scroll)
        const unravelIntensity = Math.max(0, (scrollPos - 0.1) * 2.5);

        strandPoints.forEach(strand => {
            const positions = strand.obj.geometry.attributes.position.array;
            const originals = strand.original;

            for (let i = 0; i < originals.length; i++) {
                const i3 = i * 3;
                const orig = originals[i];

                // Add noise based on unravel intensity and sine wave for "organic" floating
                const noiseX = (Math.sin(time + i * 0.1) * 2 + (Math.random() - 0.5) * 10) * unravelIntensity;
                const noiseY = (Math.cos(time + i * 0.1) * 2 + (Math.random() - 0.5) * 10) * unravelIntensity;
                const noiseZ = (Math.sin(time * 0.8 + i) * 2 + (Math.random() - 0.5) * 10) * unravelIntensity;

                positions[i3] = orig.x + noiseX;
                positions[i3 + 1] = orig.y + noiseY;
                positions[i3 + 2] = orig.z + noiseZ;
            }
            strand.obj.geometry.attributes.position.needsUpdate = true;
        });

        // 3. Simple camera parallax
        camera.position.z = 250 + (scrollPos * 100); // Zoom out slowly as we unravel
        camera.position.y = (scrollPos * -200) + 100;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    function setTheme(themeName) {
        currentTheme = themeName;
        const config = THEME_COLORS[themeName] || THEME_COLORS['dark'];
        const threeCol = new THREE.Color(config.color);
        const fogCol = new THREE.Color(config.fog);

        if (scene) {
            scene.fog.color.set(fogCol);
            strandPoints.forEach(strand => {
                strand.obj.material.color.set(threeCol);
                if (strand.obj.material.size !== undefined) {
                    strand.obj.material.size = config.particleSize;
                }
                strand.obj.material.opacity = config.opacity;
                strand.obj.material.needsUpdate = true;
            });
        }
    }

    function onWindowResize() {
        if (camera && renderer) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    return { init, setTheme };
})();
