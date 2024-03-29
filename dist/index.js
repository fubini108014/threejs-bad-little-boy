import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterControls } from './characterControls.js';
import { KeyDisplay, htmlToElements, isMoblieDevice } from "./utils.js";

// vars
let fwdValue = 0;
let bkdValue = 0;
let rgtValue = 0;
let lftValue = 0;
let tempVector = new THREE.Vector3();
let upVector = new THREE.Vector3(0, 1, 0);
let joyManager;
let currentAction = "course_chapeau";
let rotateQuarternion = new THREE.Quaternion();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.Fog(0x050505, 10, 40);

const camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    1,
    500
);
camera.position.set(10, 5, 10);

// LIGHTS
light();

const canvas = document.querySelector(".webgl");

const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
//renderer.gammaOuput = true;
renderer.outputEncoding = THREE.sRGBEncoding;

// CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 15;
orbitControls.enablePan = false;
//orbitControls.enableRotate = false;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.update();

//x y z輔助線
genAxesHelper();

// 初始化FPS顯示
let statsUI = initStats();

// Ground
ground();

if (isMoblieDevice) addJoystick();

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
    "https://unpkg.com/three@0.137.5/examples/js/libs/draco/"
);
loader.setDRACOLoader(dracoLoader);

let clock = new THREE.Clock();
let sceneTree, sceneCharacter, mixerCharacter, characterControls;

const animationsMap = new Map();

const modelList = [
    loader.loadAsync("./models/littleman.gltf"),
    loader.loadAsync("./models/tree.gltf"),
];

Promise.all(modelList)
    .then((models) => {
        // here the models are returned in deterministic order
        console.log("model: ", models);
        const [model_Character, model_Tree] = models;

        // add tree
        sceneTree = model_Tree.scene;
        sceneTree.scale.set(1, 1, 1);
        sceneTree.rotation.y = 1.5;
        scene.add(sceneTree);

        // add Character
        sceneCharacter = model_Character.scene;
        sceneCharacter.scale.set(3, 3, 3);
        sceneCharacter.rotation.y = 0.5;
        scene.add(sceneCharacter);

        // add Character Mixer
        mixerCharacter = new THREE.AnimationMixer(sceneCharacter);
        model_Character.animations.forEach((clip) => {
            let AnimationAction = mixerCharacter.clipAction(clip);
            if (clip.name === "course_chapeau") {
                AnimationAction.timeScale = 2;
            }
            animationsMap.set(clip.name, AnimationAction);
        });

        //new CharacterControls
        characterControls = new CharacterControls(
            sceneCharacter,
            mixerCharacter,
            animationsMap,
            orbitControls,
            camera,
            currentAction
        );
    })
    .catch((err) => {
        console.log(err);
    });

const keyDisplayQueue = new KeyDisplay();
const keysPressed = {};
document.addEventListener(
    "keydown",
    (e) => {
        keyDisplayQueue.down(e.key);
        if (e.shiftKey && characterControls) {
            characterControls.switchRunToggle();
        } else {
            keysPressed[e.key.toLowerCase()] = true;
        }
    },
    false
);

document.addEventListener(
    "keyup",
    (e) => {
        keyDisplayQueue.up(e.key);
        keysPressed[e.key.toLowerCase()] = false;
    },
    false
);

animate();

window.addEventListener("resize", onWindowResize);

//動畫開始
function animate() {
    requestAnimationFrame(animate);
    var delta = clock.getDelta();

    statsUI.update();
    orbitControls.update();

    if (characterControls) {
        if (isMoblieDevice)
            updateByJoyStick(sceneCharacter, orbitControls, camera, delta);
        characterControls.updateByKeyBoard(delta, keysPressed);
    }

    renderer.render(scene, camera);
}

// 建立FPS監測器
function initStats() {
    const stats = new Stats();
    stats.setMode(0); // FPS mode
    document.getElementById("Stats-output").appendChild(stats.domElement);
    return stats;
}

// 光源Lights
function light() {
    const hemiLight = new THREE.HemisphereLight(0x443333, 0x111122);
    hemiLight.name = "hemiLight";
    scene.add(hemiLight);

    const spotLight = new THREE.SpotLight();
    spotLight.name = "spotLight";
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.5;
    // spotLight.castShadow = true;
    spotLight.position.set(0, 10, 0);
    scene.add(spotLight);
}

// 地板
function ground() {
    const map = new THREE.TextureLoader().load("./textures/uv_grid_opengl.jpg");
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(15, 15);
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 70),
        new THREE.MeshPhongMaterial({
            color: 0x999999,
            specular: 0x101010,
            map,
        })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.0001;
    // plane.receiveShadow = true;
    scene.add(plane);
}

/*
var planeXZ = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var intersects = new THREE.Vector3();

function getPositionOnMouseClick(e, cam) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, cam);
  raycaster.ray.intersectPlane(planeXZ, intersects);
  return intersects;
}
*/

// RWD
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

//xyz軸輔助線
function genAxesHelper() {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
}

function updateByJoyStick(model, controls, cam, delt) {
    // move the player
    const angle = controls.getAzimuthalAngle();
    let play = "";

    if (fwdValue > 0) {
        tempVector.set(0, 0, -fwdValue).applyAxisAngle(upVector, angle);
        model.position.addScaledVector(tempVector, 0.1);
    }

    if (bkdValue > 0) {
        tempVector.set(0, 0, bkdValue).applyAxisAngle(upVector, angle);
        model.position.addScaledVector(tempVector, 0.1);
    }

    if (lftValue > 0) {
        tempVector.set(-lftValue, 0, 0).applyAxisAngle(upVector, angle);
        model.position.addScaledVector(tempVector, 0.1);
    }

    if (rgtValue > 0) {
        tempVector.set(rgtValue, 0, 0).applyAxisAngle(upVector, angle);
        model.position.addScaledVector(tempVector, 0.1);
    }

    if (fwdValue > 0 || bkdValue > 0 || lftValue > 0 || rgtValue > 0) {
        play = "course_chapeau";

        // rotate model
        rotateQuarternion.setFromAxisAngle(
            upVector,
            angle + Math.atan2(rgtValue - lftValue, bkdValue - fwdValue)
        );

        model.quaternion.rotateTowards(rotateQuarternion, 1);
    } else {
        play = "pose_chapeau";
    }

    if (currentAction != play) {
        const toPlay = animationsMap.get(play);
        const current = animationsMap.get(currentAction);

        current.fadeOut(0.2);
        toPlay.reset().fadeIn(0.2).play();

        currentAction = play;
    }
    model.updateMatrixWorld();

    // reposition camera
    cam.position.sub(controls.target);
    cam.position.add(model.position);
    controls.target.copy(model.position);
}

function addJoystick() {
    const joyStickEl =
        '<div id="mobileInterface" class="noSelect"><div id="joystickWrapper1"></div></div>';
    document.body.append(htmlToElements(joyStickEl));
    const options = {
        zone: document.getElementById("joystickWrapper1"),
        size: 120,
        multitouch: true,
        maxNumberOfNipples: 2,
        mode: "static",
        restJoystick: true,
        shape: "circle",
        // position: { top: 20, left: 20 },
        position: { top: "60px", left: "60px" },
        dynamicPage: true,
    };

    joyManager = nipplejs.create(options);

    joyManager["0"].on("move", function (evt, data) {
        const forward = data.vector.y;
        const turn = data.vector.x;

        if (forward > 0) {
            fwdValue = Math.abs(forward);
            bkdValue = 0;
        } else if (forward < 0) {
            fwdValue = 0;
            bkdValue = Math.abs(forward);
        }

        if (turn > 0) {
            lftValue = 0;
            rgtValue = Math.abs(turn);
        } else if (turn < 0) {
            lftValue = Math.abs(turn);
            rgtValue = 0;
        }
    });

    joyManager["0"].on("end", function (evt) {
        bkdValue = 0;
        fwdValue = 0;
        lftValue = 0;
        rgtValue = 0;
    });
}
