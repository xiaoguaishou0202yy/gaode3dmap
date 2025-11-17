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

                self.modelLngLat = self.userLocation;
                
                // 加载角色模型
                self.loadCharacterModel();
            },
            render: () => {
                if (!self.gltfObj) return;
                
                // 更新角色位置
                self.updateCharacterPosition();
                
                // 获取地图的旋转角度和俯仰角
                const rotation = self.map.getRotation(); // 地图旋转角度（度）
                const pitch = self.map.getPitch(); // 地图俯仰角（度）
                
                // 转换为弧度
                const rotationRad = rotation * Math.PI / 180;
                const pitchRad = pitch * Math.PI / 180;
                
                // 相机距离和高度
                const cameraDistance = 30; // 相机距离角色的距离
                const cameraHeight = 20;   // 相机的高度偏移
                
                // 计算相机位置（在角色后方）
                // 考虑地图旋转，相机需要绕Z轴旋转
                const camX = self.gltfObj.position.x - Math.sin(rotationRad) * cameraDistance * Math.cos(pitchRad);
                const camY = self.gltfObj.position.y - Math.cos(rotationRad) * cameraDistance * Math.cos(pitchRad);
                const camZ = self.gltfObj.position.z + cameraHeight + Math.sin(pitchRad) * cameraDistance;
                
                self.camera.position.set(camX, camY, camZ);
                
                // 相机始终看向角色
                self.camera.lookAt(
                    self.gltfObj.position.x,
                    self.gltfObj.position.y,
                    self.gltfObj.position.z + 10  // 看向角色的头部位置
                );
                
                // 同步角色模型的旋转方向
                self.gltfObj.rotation.z = -rotationRad; // 让角色朝向与地图方向一致
                
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
                // 初始位置设为原点，后续在render中更新
                this.gltfObj.position.set(0, 0, 5);
                this.gltfObj.scale.set(2, 2, 2);
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

    updateCharacterPosition() {
        if (!this.gltfObj || !this.modelLngLat) return;
        
        // 获取当前地图中心和缩放
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        
        // 计算模型经纬度相对于地图中心的偏移（度）
        const lngOffset = this.modelLngLat[0] - center.lng;
        const latOffset = this.modelLngLat[1] - center.lat;
        
        // 转换为米（墨卡托投影）
        const R = 6378137; // 地球半径（米）
        const centerLatRad = center.lat * Math.PI / 180;
        
        // 经度偏移转米（考虑纬度影响）
        const xMeters = lngOffset * Math.PI / 180 * R * Math.cos(centerLatRad);
        // 纬度偏移转米
        const yMeters = latOffset * Math.PI / 180 * R;
        
        // 设置模型位置（GLCustomLayer的单位是米）
        this.gltfObj.position.set(xMeters, yMeters, 5);
        
        // 根据缩放级别调整模型大小
        const baseZoom = 18;
        const baseScale = 3;
        const scaleFactor = Math.pow(1.3, zoom - baseZoom);
        
        this.gltfObj.scale.set(
            baseScale * scaleFactor,
            baseScale * scaleFactor,
            baseScale * scaleFactor
        );
    }
}

// 页面加载完成后初始化应用
window.addEventListener('load', () => {
    new SimpleMap3D();
});