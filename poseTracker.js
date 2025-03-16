import * as posenet from "@tensorflow-models/posenet";
import "@tensorflow/tfjs";

const videoElement = document.getElementById("video");

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
    });
    videoElement.srcObject = stream;
    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resolve(videoElement);
        };
    });
}

async function detectPose() {
    const net = await posenet.load();
    const video = await setupCamera();
    video.play();

    let repCount = 0;
    let down = false;

    async function trackMovement() {
        const pose = await net.estimateSinglePose(video, {
            flipHorizontal: false,
        });

        const rightShoulder = pose.keypoints[6].position.y;
        const rightElbow = pose.keypoints[8].position.y;

        if (rightElbow > rightShoulder && !down) {
            down = true;
        } else if (rightElbow <= rightShoulder + 5 && down) {
            repCount++;
            down = false;
            document.getElementById("reps").innerText = `Push-ups: ${repCount}`;
        }

        requestAnimationFrame(trackMovement);
    }

    trackMovement();
}

detectPose();
