const videoInput = document.getElementById("videoInput");
const selectVideo = document.getElementById("selectVideo");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const repsCountEl = document.getElementById("repsCount");
const vidCon = document.getElementById("vid-con");
const startBtn = document.getElementById("str-btn");
const startButton = document.getElementById("start");
const summary = document.getElementById("summ");
const summText = document.getElementById("summ-text");
const currCount = document.getElementById("curr-count");
const cam = document.getElementById("cam");
const trackPoints = document.getElementById("Track-P");
const playAgain = document.getElementById("p-again");

console.log("Lunges tracking started...");

let lungeCount = 0;
let isLunging = false;
let pose;
let smoothedKeypoints = {};
const alpha = 0.6; // Smoothing factor
let isLiveTracking = false;

selectVideo.addEventListener("click", () => videoInput.click());

// Load selected video
videoInput.addEventListener("change", (event) => {
    // vidCon.style.display = "flex";
    // startBtn.style.display = "flex";
    // cam.style.display = "none";
    // selectVideo.textContent = "Select a new Video";
    toggleButtons();
    isLiveTracking = false;
    stopCamera();
    const file = event.target.files[0];

    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
    }
});

function toggleButtons(){
    vidCon.style.display = "flex";
    startBtn.style.display = "flex";
    cam.style.display = "none";
    selectVideo.textContent = "Select a new Video";

    currCount.style.display = "flex";
    summary.style.display = "none";
    startBtn.style.display = "flex";
}

startButton.addEventListener("click", () => {
    video.playbackRate = 0.08;
    if (video.paused) {
        video.play();
        startButton.textContent = "Stop Tracking";
    } else {
        video.pause();
    }
});

function startCamera() {
    isLiveTracking = true;
    stopCamera();
    toggleButtons();
    vidCon.classList.add("mirrored");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((error) => console.error("Error accessing camera:", error));
    } else {
        console.error("getUserMedia not supported.");
    }
}

cam.addEventListener("click", startCamera);

function stopCamera() {
    if (video.srcObject) {
        let tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
}

// Toggle tracking points visibility
let tp = true;
trackPoints.addEventListener("click", () => {
    canvas.style.opacity = tp ? "0%" : "100%";
    trackPoints.textContent = tp ? "Show Tracking Points" : "Hide Tracking Points";
    tp = !tp;
});

// Start Pose Tracking
async function startPoseTracking() {
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    pose.onResults(onResults);
    console.log("BlazePose model loaded");

    if (isLiveTracking) {
        processLiveVideo();
    } else {
        video.addEventListener("play", () => {
            processVideo();
        });
    }
}

async function processVideo() {
    if (video.paused || video.ended) return;
    await pose.send({ image: video });
    requestAnimationFrame(processVideo);
}

async function processLiveVideo() {
    if (!isLiveTracking) return;
    await pose.send({ image: video });
    requestAnimationFrame(processLiveVideo);
}

// Helper function to smooth keypoints
function smoothKeypoint(index, x, y) {
    if (!smoothedKeypoints[index]) {
        smoothedKeypoints[index] = { x, y };
    } else {
        smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
        smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
    }
}

// Function to process pose landmarks and detect lunges
function processPose(keypoints) {
    console.log("Processing Pose for Lunges...");

    // Left and Right keypoints for lunges
    const leftPoints = [23, 25, 27];  // Left hip, knee, ankle
    const rightPoints = [24, 26, 28]; // Right hip, knee, ankle

    // Calculate visibility scores
    const leftVisibility = leftPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / leftPoints.length;
    const rightVisibility = rightPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / rightPoints.length;

    let frontLeg, backLeg;
    if (keypoints[25].y < keypoints[26].y) {
        frontLeg = leftPoints;
        backLeg = rightPoints;
    } else {
        frontLeg = rightPoints;
        backLeg = leftPoints;
    }

    // Smooth selected keypoints
    [...frontLeg, ...backLeg].forEach(index => {
        smoothKeypoint(index, keypoints[index].x, keypoints[index].y);
    });

    // Draw keypoints
    [...frontLeg, ...backLeg].forEach(index => {
        const { x, y } = smoothedKeypoints[index];
        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple";
        ctx.fill();
    });

    // Lunge detection logic
    const frontHipY = smoothedKeypoints[frontLeg[0]].y;
    const frontKneeY = smoothedKeypoints[frontLeg[1]].y;
    const frontAnkleY = smoothedKeypoints[frontLeg[2]].y;

    const backKneeY = smoothedKeypoints[backLeg[1]].y;

    // Lunge down condition: front knee bends and back knee goes lower
    if (frontKneeY > frontHipY && backKneeY > frontAnkleY && !isLunging) {
        isLunging = true;
    }
    // Lunge up condition: returning to the original stance
    else if (frontKneeY < frontHipY && isLunging) {
        lungeCount++;
        repsCountEl.textContent = lungeCount;
        isLunging = false;
    }

    video.playbackRate = 0.9;
}

// Handle pose results
function onResults(results) {
    if (!results.poseLandmarks) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    processPose(results.poseLandmarks);
}

video.addEventListener('ended', function() {
    currCount.style.display = "none";
    summary.style.display = "flex";
    startBtn.style.display = "none";
    summText.textContent = `You have performed ${lungeCount} reps of lunges in this video. Keep going!`;
});

playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toogleButtons();
    lungeCount = 0;
    repsCountEl.textContent = lungeCount;
});

startPoseTracking();









// // Import MediaPipe BlazePose Library
// const videoInput = document.getElementById("videoInput");
// const selectVideo = document.getElementById("selectVideo");
// const video = document.getElementById("video");
// const canvas = document.getElementById("canvas");
// const ctx = canvas.getContext("2d");
// const repsCountEl = document.getElementById("repsCount");
// const vidCon = document.getElementById("vid-con");
// const startBtn = document.getElementById("str-btn");
// const startButton = document.getElementById("start");
// const summary = document.getElementById("summ");
// const summText = document.getElementById("summ-text");
// const currCount = document.getElementById("curr-count");
// const cam = document.getElementById("cam");



// let repCount = 0;
// let isDown = false;
// let pose;
// let fullBodyVisible = false; // Flag to check if the full body is detected

// // Open file picker when button is clicked
// selectVideo.addEventListener("click", () => videoInput.click());

// // Load selected video
// videoInput.addEventListener("change", (event) => {
//     vidCon.style.display = "flex";
//     startBtn.style.display = "flex";
//     cam.style.display = "none";
//     selectVideo.textContent = "Select a new Video"
//     const file = event.target.files[0];
//     console.log("Video selected");
//     if (file) {
//         video.src = URL.createObjectURL(file);
//         video.load();
        
//     }
// });



// // Play video when clicked
// startBtn.addEventListener("click", () => {
//     video.playbackRate = 0.9;
//     if (video.paused) {
//         video.play();
//         startButton.textContent = "Stop Tracking"
//     } else {
//         video.pause();
//     }
// });

// // Load BlazePose Model
// async function startPoseTracking() {
//     pose = new Pose({
//         locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
//     });

//     pose.setOptions({
//         modelComplexity: 1,
//         smoothLandmarks: true,
//         enableSegmentation: false,
//         minDetectionConfidence: 0.6,
//         minTrackingConfidence: 0.6
//     });

//     pose.onResults(onResults);

//     console.log("BlazePose model loaded");

//     // Process frames when video is playing
//     video.addEventListener("play", () => {
//         processVideo();
//     });
// }

// // Process frames from the video
// async function processVideo() {
//     if (video.paused || video.ended) return;
//     await pose.send({ image: video });
//     requestAnimationFrame(processVideo);
// }

// // Adjust speed to maintain tracking quality
// // function adjustSpeed() {
// //     if (video.playbackRate > 0.7) video.playbackRate -= 0.1;
// // }
// // setInterval(adjustSpeed, 2000); // Check speed every 2 seconds

// // Check if full body is visible
// function isFullBodyVisible(keypoints) {
//     // const requiredIndexes = [0, 12, 14, 16, 24, 26, 28]; // Head, Right Shoulder, Right Elbow, Right Wrist, Right Hip, Right Knee, Right Ankle
//     const requiredIndexes = [0, 12, 14, 16, 31]; // Head, Right Shoulder, Right Elbow, Right Wrist, Right Hip, Right Knee, Right Ankle
//     const confidenceThreshold = 0.5;

//     return requiredIndexes.every(index => keypoints[index] && keypoints[index].visibility > confidenceThreshold);
// }

// // Process pose results
// function onResults(results) {
//     if (!results.poseLandmarks) return;

//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//     fullBodyVisible = isFullBodyVisible(results.poseLandmarks); // Check full body visibility

//     processPose(results.poseLandmarks);
//     // drawKeypoints(results.poseLandmarks);

//     // if (fullBodyVisible) {
//         // countReps(results.poseLandmarks);
//     // } else {
//         // console.log("Full body not detected, rep counting disabled");
//     // }
// }

// let smoothedKeypoints = {}; // Store previous keypoints for smoothing

// let smoothedElbow = { x: null, y: null }; // Store previous smoothed position
// const smoothingFactor = 0.7; // Adjust smoothness (closer to 1 = more smooth)

// function smoothKeypoint(original, smoothed, alpha) {
//     if (smoothed.x === null || smoothed.y === null) {
//         // Initialize with the first detected value
//         smoothed.x = original.x;
//         smoothed.y = original.y;
//     } else {
//         // Apply exponential smoothing
//         smoothed.x = alpha * smoothed.x + (1 - alpha) * original.x;
//         smoothed.y = alpha * smoothed.y + (1 - alpha) * original.y;
//     }
// }

// function processPose(keypoints) {
//     if (!fullBodyVisible) return; // Ensure reps count only when full body is visible

//     const selectedIndexes = [12, 14, 24, 26, 28]; // Right Shoulder, Right Elbow, Right Hip, Right Knee, Right Ankle
//     const smoothIndexes = [24, 26]; // Smooth Right Hip and Right Knee
//     const alpha = 0.3; // Smoothing factor

//     // Smooth selected keypoints
//     smoothIndexes.forEach(index => {
//         const { x, y } = keypoints[index];

//         if (!smoothedKeypoints[index]) {
//             smoothedKeypoints[index] = { x, y };
//         } else {
//             smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
//             smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
//         }
//     });

//     // Draw keypoints
//     selectedIndexes.forEach(index => {
//         const { x, y } = smoothedKeypoints[index] || keypoints[index]; // Use smoothed if available

//         ctx.beginPath();
//         ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
//         ctx.fillStyle = "purple"; 
//         ctx.fill();
//     });

//     // Count reps using smoothed values
//     const rightHip = smoothedKeypoints[24]?.y || keypoints[24].y;
//     const rightKnee = smoothedKeypoints[26]?.y || keypoints[26].y;

//     console.log("Counting lunges smoothly");

//     if (rightKnee > rightHip && !isDown) {
//         isDown = true;
//     } else if (rightKnee < rightHip && isDown) {
//         repCount++;
//         isDown = false;
//         repsCountEl.textContent = repCount;
//     }
// }

