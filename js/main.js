// 主应用程序
class SimpleMap3D {
    constructor() {
        this.map = null;
        this.init();
    }

    // 初始化地图
    init() {
        // 创建地图实例
        this.map = new AMap.Map('map', CONFIG.MAP_CONFIG);
        
        // 添加控件
        this.addControls();
        
        // 添加事件监听
        this.addEventListeners();
        
        // 初始化UI控制
        this.initUIControls();
        
        // 初始更新地图信息
        this.updateMapInfo();
        
        console.log('高德地图3D应用初始化完成');
    }

    // 添加地图控件
    addControls() {
        // 缩放控件
        this.map.addControl(new AMap.Zoom({position: 'RT'}));
        
        // 比例尺控件
        this.map.addControl(new AMap.Scale({position: 'LB'}));
        
        // 工具栏
        this.map.addControl(new AMap.ToolBar({
            position: 'RB'
        }));
    }

    // 添加事件监听
    addEventListeners() {
        // 地图移动事件
        this.map.on('moveend', () => {
            this.updateMapInfo();
        });
        
        // 地图缩放事件
        this.map.on('zoomchange', () => {
            this.updateMapInfo();
        });
        
        // 地图俯仰角度变化事件
        this.map.on('pitchchange', () => {
            this.updateMapInfo();
        });
    }

    // 更新地图信息显示
    updateMapInfo() {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        const pitch = this.map.getPitch();
        
        document.getElementById('zoomLevel').textContent = zoom.toFixed(2);
        document.getElementById('centerCoord').textContent = 
            `经度: ${center.lng.toFixed(6)}, 纬度: ${center.lat.toFixed(6)}`;
        document.getElementById('pitchAngle').textContent = `${pitch.toFixed(1)}°`;
    }



}

// 页面加载完成后初始化应用
window.addEventListener('load', () => {
    new SimpleMap3D();
});