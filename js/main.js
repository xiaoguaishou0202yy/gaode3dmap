import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

class SimpleMap3D {
    constructor() {
        this.map = null;
        this.gltfObj = null;
        this.customLayer = null;
        this.userLocation = null;
        
        this.init();
    }

    // 初始化地图
    async init() {
        this.showLoading(true);
        await this.getUserLocation();
        
        const center = this.userLocation || [116.397428, 39.90923]; // 默认北京
        
        this.map = new AMap.Map('map', {
            center: center,
            zoom: 22,
            viewMode: '3D',
            pitch: 60,
            rotation: 0
        });
        
        this.showLoading(false);
        this.createThreeLayer();
    }

    // 显示/隐藏加载提示
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    // 获取用户位置
    getUserLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.log('浏览器不支持地理定位');
                resolve();
                return;
            }

            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000
            });

            geolocation.getCurrentPosition((status, result) => {
                if (status === 'complete') {
                    this.userLocation = [result.position.lng, result.position.lat];
                    console.log('定位成功:', this.userLocation);
                } else {
                    console.log('定位失败，使用默认位置');
                }
                resolve();
            });
        });
    }

    createThreeLayer() {
        const self = this;
        
        this.customLayer = new AMap.GLCustomLayer({
            zIndex: 10,
            init: (gl) => {
                // 创建 Three.js 场景
                self.scene = new THREE.Scene();
                
                // 创建相机
                self.camera = new THREE.PerspectiveCamera(
                    45,
                    window.innerWidth / window.innerHeight,
                    0.1,
                    1000
                );
                
                self.renderer = new THREE.WebGLRenderer({
                    context: gl,
                    alpha: true,
                    antialias: false,
                    precision: 'mediump',
                    powerPreference: 'high-performance', // 添加性能优化
                    preserveDrawingBuffer: false, // 避免缓冲区冲突
                    willReadFrequently: false
                });
                
                // 重要：不要让 Three.js 自动清除状态
                self.renderer.autoClear = false;
                self.renderer.autoClearDepth = false;
                self.renderer.autoClearColor = false;
                self.renderer.autoClearStencil = false;
                
                // 保存 gl 上下文引用
                self.gl = gl;

                // 添加坐标轴辅助器（调试用）
                self.axesHelper = new THREE.AxesHelper(50);
                self.scene.add(self.axesHelper);

                // 光源
                const ambientLight = new THREE.AmbientLight(0xffffff, 4);
                self.scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
                directionalLight.position.set(10, 10, 10);
                self.scene.add(directionalLight);

                self.modelLngLat = self.userLocation;
                
                // 加载角色模型
                self.loadCharacterModel();
            },
            render: () => {
                if (!self.gltfObj || !self.modelLngLat) return;
                
                const gl = self.gl;
                
                try {
                    // 修复2：简化状态管理，避免复杂的WebGL状态保存/恢复
                    
                    // 重置 Three.js 的 WebGL 状态
                    self.renderer.resetState();
                    
                    // 设置必要的 WebGL 状态
                    gl.enable(gl.DEPTH_TEST);
                    gl.depthFunc(gl.LEQUAL);
                    
                    // 位置计算代码保持不变...
                    const center = self.map.getCenter();
                    const centerLng = center.lng;
                    const centerLat = center.lat;
                    const modelLng = self.modelLngLat[0];
                    const modelLat = self.modelLngLat[1];
                    
                    const EARTH_RADIUS = 6378137;
                    const dLng = (modelLng - centerLng) * Math.PI / 180;
                    const avgLat = (centerLat + modelLat) / 2 * Math.PI / 180;
                    const x = dLng * EARTH_RADIUS * Math.cos(avgLat);
                    const dLat = (modelLat - centerLat) * Math.PI / 180;
                    const y = dLat * EARTH_RADIUS;
                    
                    self.gltfObj.position.set(x, y, 0);
                    
                    if (self.axesHelper) {
                        self.axesHelper.position.set(x, y, 0);
                    }
                    
                    const zoom = self.map.getZoom();
                    const baseZoom = 18;
                    const baseScale = 0.2;
                    const scaleFactor = Math.pow(1.3, zoom - baseZoom);
                    
                    self.gltfObj.scale.set(
                        baseScale * scaleFactor,
                        baseScale * scaleFactor,
                        baseScale * scaleFactor
                    );
                    
                    if (self.axesHelper) {
                        const axesScale = 10 * scaleFactor;
                        self.axesHelper.scale.set(axesScale, axesScale, axesScale);
                    }
                    
                    const rotation = self.map.getRotation();
                    const pitch = self.map.getPitch();
                    const rotationRad = rotation * Math.PI / 180;
                    const pitchRad = pitch * Math.PI / 180;
                    
                    const cameraDistance = 30;
                    const cameraHeight = 20;
                    const camX = self.gltfObj.position.x - Math.sin(rotationRad) * cameraDistance * Math.cos(pitchRad);
                    const camY = self.gltfObj.position.y - Math.cos(rotationRad) * cameraDistance * Math.cos(pitchRad);
                    const camZ = self.gltfObj.position.z + cameraHeight + Math.sin(pitchRad) * cameraDistance;
                    
                    self.camera.position.set(camX, camY, camZ);
                    
                    const upX = Math.sin(rotationRad) * Math.sin(pitchRad);
                    const upY = Math.cos(rotationRad) * Math.sin(pitchRad);
                    const upZ = Math.cos(pitchRad);
                    self.camera.up.set(upX, upY, upZ);
                    
                    self.camera.lookAt(
                        self.gltfObj.position.x,
                        self.gltfObj.position.y,
                        self.gltfObj.position.z + 10
                    );
                    
                    gl.disable(gl.BLEND); // 如果不使用透明，禁用混合
                    // 渲染场景
                    self.renderer.render(self.scene, self.camera);
                    
                } catch (error) {
                    console.error('Three.js渲染错误:', error);
                }
            }
        });
        
        this.map.add(this.customLayer);
    }

    loadCharacterModel() {
        const loader = new GLTFLoader();
        
        loader.load(
            'assets/cartoon_car.glb',
            (gltf) => {
                this.gltfObj = gltf.scene;

                this.gltfObj.traverse((child) => {
                    if (child.isMesh) {
                        // 确保几何体正确上传到GPU
                        child.geometry.computeVertexNormals();
                        
                        // 优化材质
                        if (child.material) {
                            child.material.precision = 'mediump';
                            child.material.needsUpdate = false;
                        }

                        child.castShadow = false;
                        child.receiveShadow = false;
                    }
                });
                
                this.gltfObj.position.set(0, 0, 0);  // 初识位置设为原点
                this.gltfObj.scale.set(0.1, 0.1, 0.1);  // 初始大小
                this.scene.add(this.gltfObj);
                console.log('角色模型加载成功');

                if (window.gc) {
                    setTimeout(() => window.gc(), 1000);
                }
            },
            (progress) => {
                console.log('加载进度:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('模型加载失败:', error);
            }
        );
    }


}

// 页面加载完成后初始化应用
window.addEventListener('load', () => {
    new SimpleMap3D();
});