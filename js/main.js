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

    // 创建 Three.js 自定义图层
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
                    antialias: true,
                    precision: 'mediump'
                });
                self.renderer.autoClear = false;


                // 添加坐标轴辅助器（调试用）
                const axesHelper = new THREE.AxesHelper(50);
                self.scene.add(axesHelper);

                // 光源
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
                self.scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
                directionalLight.position.set(10, 10, 10);
                self.scene.add(directionalLight);
                
                // 加载角色模型
                self.loadCharacterModel();
            },
            render: () => {
                if (!self.gltfObj) return;
                
                // 更新角色位置
                self.updateCharacterPosition();
                
                // 相机位置固定，不随缩放变化
                self.camera.position.set(0, 0, 100);
                self.camera.lookAt(0, 0, 0);
                
                // 渲染场景
                self.renderer.resetState();
                self.renderer.render(self.scene, self.camera);
            }
        });
        
        this.map.add(this.customLayer);
    }

    // 加载角色模型
    loadCharacterModel() {
        const loader = new GLTFLoader();
        
        loader.load(
            'assets/Xbot.glb',
            (gltf) => {
                this.gltfObj = gltf.scene;
                this.gltfObj.scale.set(10, 10, 10);
                this.gltfObj.position.set(0, 0, 5);
                this.scene.add(this.gltfObj);
                console.log('角色模型加载成功');
            },
            (progress) => {
                console.log('加载进度:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('模型加载失败:', error);
            }
        );
    }

    // 更新角色位置到用户位置
    updateCharacterPosition() {
        if (!this.gltfObj || !this.userLocation) return;
        
        // 获取当前地图状态
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        
        // 计算用户位置和地图中心在像素坐标系中的位置
        const userPixel = this.map.lngLatToContainer(this.userLocation);
        const centerPixel = this.map.lngLatToContainer([center.lng, center.lat]);
        
        // 计算相对偏移（像素）
        const pixelOffsetX = userPixel.x - centerPixel.x;
        const pixelOffsetY = userPixel.y - centerPixel.y;
        
        // 将像素偏移转换为固定的世界坐标偏移
        // 使用与缩放级别无关的固定转换因子
        const worldScale = 0.0005; // 调整这个值来改变灵敏度
        
        // 设置模型位置
        this.gltfObj.position.set(
            pixelOffsetX * worldScale,
            -pixelOffsetY * worldScale, // Y轴取反
            5
        );
        
        // 模型大小随缩放变化
        const baseZoom = 17;
        const scale = Math.pow(1.5, zoom - baseZoom);
        this.gltfObj.scale.set(10 * scale, 10 * scale, 10 * scale);
        
        // 添加调试信息
        if (window.debugMode) {
            console.log('用户位置:', this.userLocation);
            console.log('像素偏移:', {x: pixelOffsetX, y: pixelOffsetY});
            console.log('模型位置:', this.gltfObj.position);
        }
    }


}

// 页面加载完成后初始化应用
window.addEventListener('load', () => {
    new SimpleMap3D();
});