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

let isLiveTracking = false;




function startCamera() {
    isLiveTracking = true;
    // isLiveTracking = true
    video.style.width = "640px";
    video.style.height = "480px";

    canvas.style.width = "640px";
    canvas.style.height = "480px";

    startButton.textContent = "Stop Camera";

    stopCamera();
    toogleButtons();

    

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



let tp = true;
trackPoints.addEventListener("click",() => {
    if(tp){
        canvas.style.opacity = "0%";
        trackPoints.textContent = "Show Tracking Points";
        tp = false;
    } else {
        canvas.style.opacity = "100%";
        trackPoints.textContent = "Hide Tracking Points";
        tp = true;

    }

})


let repCount = 0;
let isDown = false;
let pose;
let fullBodyVisible = false; 

selectVideo.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", (event) => {
    toogleButtons();
    isLiveTracking = false;
    stopCamera(); // Stop live tracking if switching to recorded video
    const file = event.target.files[0];

    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
    }
});

function toogleButtons() {
    vidCon.style.display = "flex";
    startBtn.style.display = "flex";
    cam.style.display = "none";
    selectVideo.textContent = "Select a new Video";

    currCount.style.display = "flex";
    summary.style.display = "none";
    startBtn.style.display = "flex";
}




startButton.addEventListener("click", () => {
    video.playbackRate = 0.5;
    if (video.paused) {
        video.play();
        if(isLiveTracking){
            startButton.textContent = "Start Camera";
        } else {
            startButton.textContent = "Stop Tracking"
        }
    } else {
        video.pause();
    }
});


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

// function adjustSpeed() {
//     if (video.playbackRate > 0.7) video.playbackRate -= 0.1;
// }
// setInterval(adjustSpeed, 2000);


function isFullBodyVisible(keypoints) {
    const requiredIndexes = [0, 12, 14, 16, 31]; // Head, Right Shoulder, Right Elbow, Right Wrist, Right Hip, Right Knee, Right Ankle
    const confidenceThreshold = 0.5;

    return requiredIndexes.every(index => keypoints[index] && keypoints[index].visibility > confidenceThreshold);
}

// Process pose results
function onResults(results) {
    if (!results.poseLandmarks) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    fullBodyVisible = isFullBodyVisible(results.poseLandmarks); // Check full body visibility

    processPose(results.poseLandmarks);
    
}

let smoothedKeypoints = {}; 

let smoothedElbow = { x: null, y: null }; 
const smoothingFactor = 0.7; 

function smoothKeypoint(original, smoothed, alpha) {
    if (smoothed.x === null || smoothed.y === null) {
        smoothed.x = original.x;
        smoothed.y = original.y;
    } else {
        smoothed.x = alpha * smoothed.x + (1 - alpha) * original.x;
        smoothed.y = alpha * smoothed.y + (1 - alpha) * original.y;
    }
}


function processPose(keypoints) {
    const alpha = 0.2; // Smoothing factor

    // Check visibility of left and right side keypoints
    const leftPoints = [0, 11, 13, 15, 23, 31]; // Left shoulder, elbow, wrist
    const rightPoints = [0, 12, 14, 16, 24, 32]; // Right shoulder, elbow, wrist

    // const noseIndex = 0; 
    const leftHip = 23, rightHip = 24; 
    const leftKnee = 25, rightKnee = 26; 
    const leftAnkle = 27, rightAnkle = 28; 

    const leftVisibility = leftPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / leftPoints.length;
    const rightVisibility = rightPoints.reduce((sum, idx) => sum + (keypoints[idx]?.visibility || 0), 0) / rightPoints.length;

    // Select the side with higher average visibility
    let shoulderIndex, elbowIndex, wristIndex;
    if (rightVisibility >= leftVisibility) {
        [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, footIndex] = rightPoints;
    } else {
        [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, footIndex] = leftPoints;
    }

    // Smooth selected keypoints
    [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, footIndex].forEach(index => {
        const { x, y } = keypoints[index];

        if (!smoothedKeypoints[index]) {
            smoothedKeypoints[index] = { x, y };
        } else {
            smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
            smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
        }
    });

    // Drawing keypoints here
    [noseIndex, shoulderIndex, elbowIndex, wristIndex, hipsIndex, footIndex].forEach(index => {
        const { x, y } = smoothedKeypoints[index] || keypoints[index];

        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple"; 
        ctx.fill();
    });



    // // Draw Stick Figure (Lines)
    // const connections = [
    //     [noseIndex, shoulderIndex], 
    //     [shoulderIndex, elbowIndex], 
    //     [elbowIndex, wristIndex], 
    //     [leftHip, rightHip],      
    //     [leftHip, leftKnee],  
    //     [rightHip, rightKnee], 
    //     [leftKnee, leftAnkle],    
    //     [rightKnee, rightAnkle]    
    // ];

    // ctx.strokeStyle = "cyan";
    // ctx.lineWidth = 3;

    // connections.forEach(([start, end]) => {
    //     if (smoothedKeypoints[start] && smoothedKeypoints[end]) {
    //         ctx.beginPath();
    //         ctx.moveTo(smoothedKeypoints[start].x * canvas.width, smoothedKeypoints[start].y * canvas.height);
    //         ctx.lineTo(smoothedKeypoints[end].x * canvas.width, smoothedKeypoints[end].y * canvas.height);
    //         ctx.stroke();
    //     }
    // });





    // Getting smoothed vallues
    const shoulderY = smoothedKeypoints[shoulderIndex].y;
    const elbowY = smoothedKeypoints[elbowIndex].y;
    // const wristY = smoothedKeypoints[wristIndex].y;

    // Detect push-up motion (repetitive up-down motion)
    if (elbowY < shoulderY && !isDown) {
        isDown = true; // Going down
    } else if (elbowY > shoulderY && isDown) {
        // Only count if elbow drops significantly below the shoulder
        // if (elbowY > wristY) {  
            repCount++;
            repsCountEl.textContent = repCount;
        // }
        isDown = false; // Going up
    }

    video.playbackRate = 0.9;
}





video.addEventListener('ended', function() {
    currCount.style.display = "none";
    summary.style.display = "flex";
    startBtn.style.display = "none";
    // trackPoints.style.display = "none";
    summText.textContent = "You have Performed " + repCount + " Reps and 1 Sets in this video, Carry on!!"
    
});

// const playAgain = document.getElementById("p-again");

playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toogleButtons();
    repCount = 0;
    repsCountEl.textContent = repCount;
});

startPoseTracking();





