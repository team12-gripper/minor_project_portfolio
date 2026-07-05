/**
 * CAD Visual Prototype Viewer - Three.js Implementation
 * Handles 3D rendering of the gripper STL model, controls, and local STL loading fallback.
 */

class CADViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container #${containerId} not found.`);
            return;
        }

        // Configuration
        this.activeTheme = 'matte-gray';
        this.activeDisplayMode = 'shaded'; // shaded, wireframe, points
        this.isAutoRotating = true;

        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Model group
        this.stlModelGroup = new THREE.Group();

        // Materials cache
        this.materials = {};
        this.pointsMaterial = null;

        // Loaded STL track
        this.currentStlMesh = null;
        this._fileSelectHandler = null;

        // Initialization
        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.setupHelpers();
        this.setupMaterials();
        this.setupControls();
        this.setupEventListeners();
        this.loadDefaultSTL();
        this.animate();
    }

    setupScene() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e293b); // Slate 800
        this.scene.fog = new THREE.FogExp2(0x1e293b, 0.015);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(2, 1.8, 2.5);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Clear container and append canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Add main groups to scene
        this.scene.add(this.stlModelGroup);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(5, 10, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 25;
        const d = 6;
        keyLight.shadow.camera.left = -d;
        keyLight.shadow.camera.right = d;
        keyLight.shadow.camera.top = d;
        keyLight.shadow.camera.bottom = -d;
        keyLight.shadow.bias = -0.0005;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xb1e1ff, 0.4);
        fillLight.position.set(-5, 4, -5);
        this.scene.add(fillLight);

        const bounceLight = new THREE.DirectionalLight(0x2d3748, 0.2);
        bounceLight.position.set(0, -5, 0);
        this.scene.add(bounceLight);
    }

    setupHelpers() {
        const gridHelper = new THREE.GridHelper(10, 20, 0x14bdac, 0x475569);
        gridHelper.position.y = -0.5;
        gridHelper.material.opacity = 0.25;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(0.8);
        axesHelper.position.set(-1.5, -0.48, -1.5);
        axesHelper.material.linewidth = 2;
        axesHelper.material.renderOrder = 1;
        this.scene.add(axesHelper);
    }

    setupMaterials() {
        this.materials['matte-gray'] = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.5,
            metalness: 0.15,
            side: THREE.DoubleSide
        });

        this.pointsMaterial = new THREE.PointsMaterial({
            color: 0x14bdac,
            size: 0.05,
            sizeAttenuation: true
        });
    }

    getActiveMaterial() {
        return this.materials[this.activeTheme] || this.materials['matte-gray'];
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 25;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());

        const viewport = this.container;
        const wrapper = document.getElementById('cad-viewport-wrapper') || viewport;

        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.classList.add('dragover');
        });

        wrapper.addEventListener('dragleave', () => {
            wrapper.classList.remove('dragover');
        });

        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.loadLocalSTLFile(files[0]);
            }
        });
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    setDisplayMode(mode) {
        this.activeDisplayMode = mode;
        this.updateDisplayModeForGroup(this.stlModelGroup);
    }

    updateDisplayModeForGroup(group) {
        const mode = this.activeDisplayMode;

        group.traverse((child) => {
            if (child.name === 'pointsCloudHelper') {
                child.visible = (mode === 'points');
                return;
            }

            if (child.isMesh) {
                if (mode === 'points') {
                    child.visible = false;

                    let pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (!pointsCloud) {
                        pointsCloud = new THREE.Points(child.geometry, this.pointsMaterial);
                        pointsCloud.name = 'pointsCloudHelper';
                        pointsCloud.uuid = child.uuid + '_points';
                        pointsCloud.position.copy(child.position);
                        pointsCloud.rotation.copy(child.rotation);
                        pointsCloud.scale.copy(child.scale);
                        child.parent.add(pointsCloud);
                    }
                    pointsCloud.visible = true;
                } else if (mode === 'wireframe') {
                    child.visible = true;
                    child.material.wireframe = true;
                    
                    const pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (pointsCloud) pointsCloud.visible = false;
                } else {
                    child.visible = true;
                    child.material.wireframe = false;

                    const pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (pointsCloud) pointsCloud.visible = false;
                }
            }
        });
    }

    resetView() {
        this.camera.position.set(2, 1.8, 2.5);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    // Load Gripper.STL from server/images folder
    loadDefaultSTL() {
        this.showLoading(true);
        this.clearAlert();
        
        const loader = new THREE.STLLoader();
        loader.load('images/Gripper.STL', 
            (geometry) => {
                this.showLoading(false);
                this.displaySTL(geometry, 'images/Gripper.STL');
            },
            (xhr) => {
                if (xhr.total) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    const spinner = document.getElementById('cad-viewer-spinner');
                    if (spinner) {
                        const label = spinner.querySelector('div:last-child');
                        if (label) label.textContent = `Loading Gripper.STL (${percent}%)`;
                    }
                }
            },
            (error) => {
                console.warn("Could not find Gripper.STL in the images/ directory. Waiting for user action.", error);
                this.showLoading(false);
                this.showError("Missing 'images/Gripper.STL'. Click here or drag & drop Gripper.STL to preview!");
                this.createHelpfulPlaceholder();
            }
        );
    }

    // Common display logic for loaded STL geometries
    displaySTL(geometry, filename) {
        this.clearSTLModel();

        const material = this.getActiveMaterial();
        this.currentStlMesh = new THREE.Mesh(geometry, material);
        this.currentStlMesh.castShadow = true;
        this.currentStlMesh.receiveShadow = true;

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const boundingBox = geometry.boundingBox;
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        // Normalize scale to around 3.5 units
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 3.5 / (maxDim || 1);
        this.currentStlMesh.scale.set(targetScale, targetScale, targetScale);

        // Center the geometry
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Float slightly above the floor
        this.currentStlMesh.position.set(0, 0.2, 0);

        this.stlModelGroup.add(this.currentStlMesh);
        this.stlModelGroup.visible = true;

        this.clearAlert();
        this.showSuccess(`Loaded model: ${filename}`);
        this.setDisplayMode(this.activeDisplayMode);
        this.resetView();

        // Remove the click-to-upload handler since file is successfully loaded
        const wrapper = document.getElementById('cad-viewport-wrapper');
        if (wrapper && this._fileSelectHandler) {
            wrapper.removeEventListener('click', this._fileSelectHandler);
            this._fileSelectHandler = null;
            wrapper.style.cursor = '';
            wrapper.removeAttribute('title');
        }
    }

    // Load local STL file from drag-drop or file input
    loadLocalSTLFile(file) {
        if (!file.name.toLowerCase().endsWith('.stl')) {
            this.showError('Invalid file format. Please drop a valid 3D STL file.');
            return;
        }

        this.showLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const contents = event.target.result;
            try {
                const loader = new THREE.STLLoader();
                const geometry = loader.parse(contents);

                if (!geometry || geometry.attributes.position.count === 0) {
                    throw new Error("Empty STL geometry");
                }

                this.displaySTL(geometry, file.name);
            } catch (error) {
                console.error(error);
                this.showError('Error parsing STL file. Ensure the file is not corrupted.');
            } finally {
                this.showLoading(false);
            }
        };

        reader.onerror = () => {
            this.showError('Error reading file contents.');
            this.showLoading(false);
        };

        reader.readAsArrayBuffer(file);
    }

    clearSTLModel() {
        while(this.stlModelGroup.children.length > 0) {
            const object = this.stlModelGroup.children[0];
            if (object.geometry) object.geometry.dispose();
            this.stlModelGroup.remove(object);
        }
        this.currentStlMesh = null;
    }

    createHelpfulPlaceholder() {
        this.clearSTLModel();

        // Render a clean wireframe workspace box
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569 }));
        line.name = 'placeholder';
        
        this.stlModelGroup.add(line);
        this.stlModelGroup.visible = true;
        this.resetView();

        // Make viewport wrapper clickable to upload/select a file
        const wrapper = document.getElementById('cad-viewport-wrapper');
        if (wrapper) {
            wrapper.style.cursor = 'pointer';
            wrapper.title = 'Click to select and preview Gripper.STL';
            const fileInput = document.getElementById('cad-file-input');

            if (!this._fileSelectHandler) {
                this._fileSelectHandler = () => {
                    if (fileInput) fileInput.click();
                };
                wrapper.addEventListener('click', this._fileSelectHandler);
            }
        }
    }

    showLoading(show) {
        const spinner = document.getElementById('cad-viewer-spinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showAlert(message, type = 'info') {
        const alertEl = document.getElementById('cad-viewer-alert');
        if (!alertEl) return;

        alertEl.textContent = message;
        alertEl.className = `cad-alert alert-${type} show`;

        if (type === 'success') {
            setTimeout(() => this.clearAlert(), 5000);
        }
    }

    clearAlert() {
        const alertEl = document.getElementById('cad-viewer-alert');
        if (alertEl) {
            alertEl.className = 'cad-alert';
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isAutoRotating) {
            const rotationSpeed = 0.005;
            this.stlModelGroup.rotation.y += rotationSpeed;
        }

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Bind UI controls after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('cad-viewport')) {
        const viewer = new CADViewer('cad-viewport');
        window.cadViewerInstance = viewer;

        const playBtn = document.getElementById('cad-play-pause');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid triggering click-to-upload on viewport wrapper
                viewer.isAutoRotating = !viewer.isAutoRotating;
                playBtn.innerHTML = viewer.isAutoRotating ? '⏸ Pause Orbit' : '▶ Auto Rotate';
                playBtn.classList.toggle('active', viewer.isAutoRotating);
            });
        }

        const resetBtn = document.getElementById('cad-reset-cam');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid triggering click-to-upload on viewport wrapper
                viewer.resetView();
            });
        }

        const fileInput = document.getElementById('cad-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    viewer.loadLocalSTLFile(files[0]);
                }
            });
        }
    }
});
