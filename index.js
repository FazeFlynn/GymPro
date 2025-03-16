import * as posenet from "@tensorflow-models/posenet";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

async function setupCamera() {
    video.width = 640;
    video.height = 480;

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });
    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video);
    });
}

async function loadPoseNet() {
    const net = await posenet.load();
    return net;
}

async function estimatePose(net) {
    const pose = await net.estimateSinglePose(video, {
        flipHorizontal: false,
        decodingMethod: "single-person"
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    pose.keypoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.position.x, point.position.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
    });

    requestAnimationFrame(() => estimatePose(net));
}

async function run() {
    await setupCamera();
    video.play();

    const net = await loadPoseNet();
    estimatePose(net);
}

run();
