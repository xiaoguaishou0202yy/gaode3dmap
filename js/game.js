import * as THREE from "three"
import { Octree } from 'three/examples/jsm/math/Octree'
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper'
import { Capsule } from 'three/examples/jsm/math/Capsule'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { debugObject, gui } from "../system/gui"

// ========== 常量配置 ==========
const GRAVITY = 30;

// ========== 游戏对象 ==========
const worldOctree = new Octree(); // 碰撞检测八叉树
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1.5, 0), 0.35);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const playerFixVector = new THREE.Vector3(0, 0.35, 0);

let playerOnFloor = false;
let that = null; // 主应用实例引用

// ========== 输入控制 ==========
const keyStates = {
    W: false, A: false, S: false, D: false, 
    Space: false, leftMouseBtn: false
};

const playerActionState = {
    forward: 0, // 前进状态：1=前进, -1=后退, 0=停止
    turn: 0     // 转向状态：1=右转, -1=左转, 0=停止
};

// 视角拖动灵敏度
let cameraMoveSensitivity = 0.4
gui.add({ cameraMoveSensitivity: cameraMoveSensitivity }, "cameraMoveSensitivity").step(0.1).min(0).max(1)
.onChange(function (value) {
    cameraMoveSensitivity = value;
});

// ========== 工具函数 ==========
function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider);
    playerOnFloor = false;

    if (result) {
        playerOnFloor = result.normal.y > 0;
        if (!playerOnFloor) {
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }
        playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
}

function updatePlayer(deltaTime) {
    if (!(that.player instanceof THREE.Object3D)) return;

    let speedRatio = 1.5;
    let damping = Math.exp(-20 * deltaTime) - 1;

    // 重力应用
    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
        damping *= 0.1; // 空中阻力
        speedRatio = 2;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    // 位置更新
    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime * speedRatio);
    deltaPosition.y /= speedRatio;
    playerCollider.translate(deltaPosition);
    playerCollisions();
    that.player.position.copy(new THREE.Vector3().subVectors(playerCollider.start, playerFixVector));
}

function getForwardVector() {
    that.camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}

function getSideVector() {
    that.camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(that.camera.up);
    return playerDirection;
}

function controls(deltaTime) {
    const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

    if (keyStates['W']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }
    if (keyStates['S']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['A']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['D']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }
    if (playerOnFloor && keyStates['Space']) {
        playerVelocity.y = 15; // 跳跃
    }
}

function teleportPlayerIfOob() {
    if (!(that.player instanceof THREE.Object3D)) return;
    
    // 如果玩家掉出地图，重置位置
    if (that.player.position.y <= -25) {
        playerCollider.start.set(0, 0.35, 0);
        playerCollider.end.set(0, 1, 0);
        playerCollider.radius = 0.35;
        that.player.position.copy(new THREE.Vector3().subVectors(playerCollider.start, playerFixVector));
        that.player.rotation.set(0, 0, 0);
    }
}

// ========== 高德地图地形 ==========
function loadGaodeTerrain(scene, worldOctree) {
    // 创建与高德地图匹配的平面碰撞地形
    const terrainGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    const terrainMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x4a7c59,
        transparent: true,
        opacity: 0.0 // 完全透明，只用于碰撞检测
    });
    
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.1;
    terrain.receiveShadow = true;
    scene.add(terrain);
    
    // 为地形生成碰撞检测
    worldOctree.fromGraphNode(terrain);
    
    return terrain;
}

// ========== 事件监听设置 ==========
function setupEventListeners() {
    // 键盘事件监听
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyW') { keyStates.W = true; playerActionState.forward = 1; }
        if (event.code === 'KeyA') { keyStates.A = true; playerActionState.turn = -1; }
        if (event.code === 'KeyS') { keyStates.S = true; playerActionState.forward = -1; }
        if (event.code === 'KeyD') { keyStates.D = true; playerActionState.turn = 1; }
        if (event.code === 'Space') { keyStates.Space = true; }
        
        // 防止空格键滚动页面
        if (event.code === 'Space') {
            event.preventDefault();
        }
    });
    
    document.addEventListener('keyup', (event) => {
        if (event.code === 'KeyW') { keyStates.W = false; playerActionState.forward = 0; }
        if (event.code === 'KeyA') { keyStates.A = false; playerActionState.turn = 0; }
        if (event.code === 'KeyS') { keyStates.S = false; playerActionState.forward = 0; }
        if (event.code === 'KeyD') { keyStates.D = false; playerActionState.turn = 0; }
        if (event.code === 'Space') { keyStates.Space = false; }
    });
    
    // 鼠标事件监听
    if (that.container) {
        that.container.addEventListener('mousedown', (e) => {
            if (e.button == 0) {
                keyStates.leftMouseBtn = true;
                that.container.style.cursor = 'grabbing';
            }
        });
        
        that.container.addEventListener('mouseup', (e) => {
            if (e.button == 0) {
                keyStates.leftMouseBtn = false;
                that.container.style.cursor = 'grab';
            }
        });
        
        // 鼠标移入时显示抓取光标
        that.container.addEventListener('mouseenter', () => {
            that.container.style.cursor = 'grab';
        });
        
        that.container.addEventListener('mouseleave', () => {
            keyStates.leftMouseBtn = false;
            that.container.style.cursor = 'default';
        });
    }
    
    document.addEventListener('mousemove', (event) => {
        if (keyStates.leftMouseBtn && cameraMoveSensitivity > 0) {
            // 旋转相机（水平和垂直）
            if (that.camera) {
                that.camera.rotation.y -= event.movementX / (cameraMoveSensitivity * 1000);
                that.camera.rotation.x -= event.movementY / (cameraMoveSensitivity * 1000);
                // 限制相机俯仰角度
                that.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, that.camera.rotation.x));
            }
        }
    });
}

// ========== 调试助手设置 ==========
function setupDebugHelpers() {
    // 添加八叉树调试助手
    const helper = new OctreeHelper(worldOctree);
    helper.visible = false;
    that.scene.add(helper);
    
    gui.add({ OctreeDebug: false }, 'OctreeDebug')
        .onChange(function (value) {
            helper.visible = value;
        });
}

// ========== 主游戏循环 ==========
export function gameUpdate(deltaTime) {
    controls(deltaTime);
    updatePlayer(deltaTime);
    teleportPlayerIfOob();
}

// ========== 初始化函数 ==========
export default function gameInit(th) {
    that = th;
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载高德地图碰撞地形
    loadGaodeTerrain(that.scene, worldOctree);
    
    // 设置调试助手
    setupDebugHelpers();
    
    // 加载角色模型
    loadPlayerModel();
    
    console.log('游戏系统初始化完成 - 高德地图模式');
}

// 加载角色模型
function loadPlayerModel() {
    const loader = new GLTFLoader();
    loader.load('Xbot.glb', (gltf) => {
        that.player = gltf.scene;
        that.scene.add(that.player);
        
        // 设置模型位置和缩放
        that.player.position.set(0, 0, 0);
        that.player.scale.set(1, 1, 1);
        
        // 启用阴影
        that.player.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
        
        console.log('角色模型加载完成');
        
    }, undefined, (error) => {
        console.error('模型加载失败:', error);
        // 如果模型加载失败，创建一个立方体作为替代
        createFallbackPlayer();
    });
}

// 创建备用玩家模型
function createFallbackPlayer() {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    that.player = new THREE.Mesh(geometry, material);
    that.player.castShadow = true;
    that.scene.add(that.player);
    
    console.log('使用备用立方体模型');
}