
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

console.log("Pull-ups tracking started...");

let pullUpCount = 0;
let isPullingUp = false;
let pose;
let smoothedKeypoints = {};
const alpha = 0.6; 
let isLiveTracking = false;

selectVideo.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", (event) => {
    pullUpCount = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    toggleButtons();
    isLiveTracking = false;
    stopCamera();
    const file = event.target.files[0];

    if (file) {
        video.src = URL.createObjectURL(file);
        video.load();
    }
});

function toggleButtons() {
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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


let tp = true;
trackPoints.addEventListener("click", () => {
    canvas.style.opacity = tp ? "0%" : "100%";
    trackPoints.textContent = tp ? "Show Tracking Points" : "Hide Tracking Points";
    tp = !tp;
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

function smoothKeypoint(index, x, y) {
    if (!smoothedKeypoints[index]) {
        smoothedKeypoints[index] = { x, y };
    } else {
        smoothedKeypoints[index].x = alpha * smoothedKeypoints[index].x + (1 - alpha) * x;
        smoothedKeypoints[index].y = alpha * smoothedKeypoints[index].y + (1 - alpha) * y;
    }
}

let isUp = false;

// let IsDoingEx = () => {
//     isUp = false;
// }



let ST1Id

let IsDoingEx = () => {
    ST1Id = setTimeout(() => {
        if(isUp){
            console.log('is not doing exversie');
            isUp = false;
        } else {
            console.log('Subject is doing exercise');
        }
      }, 10000);
}


let checker = true;




function processPose(keypoints) {
    // console.log("Processing Pose for Pull-ups...");

    const shoulders = [11, 12]; // Left, right shoulder
    const elbows = [13, 14]; // Left , right elbow
    const wrists = [15, 16]; // Left , right wrist

    // Smooth keypoints
    [...shoulders, ...elbows, ...wrists].forEach(index => {
        smoothKeypoint(index, keypoints[index].x, keypoints[index].y);
    });


    // console.log("Drawing keypoints");

    [...shoulders, ...elbows].forEach(index => {
        const { x, y } = smoothedKeypoints[index];
        ctx.beginPath();
        ctx.arc(x * canvas.width, y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "purple";
        ctx.fill();
        // console.log("Plotted points on you ZZQQWWQQASZZ");
    });

    const leftShoulderY = keypoints[11].y;
    const rightShoulderY = smoothedKeypoints[12].y;
    const avgShoulderY = (leftShoulderY + rightShoulderY) / 2;

    const leftWristY = smoothedKeypoints[15].y;
    const rightWristY = smoothedKeypoints[16].y;
    const avgWristY = (leftWristY + rightWristY) / 2;

    const leftElbowY = smoothedKeypoints[13].y;
    const rightElbowY = smoothedKeypoints[14].y;
    const avgElbowY = (leftElbowY + rightElbowY) / 2;

    if(avgShoulderY > avgElbowY && checker){
        isPullingUp = true;
        checker = false;
    }



    if (avgShoulderY < avgElbowY && !isPullingUp) {
        isPullingUp = true;  
        console.log("Trued");

    } else if (avgShoulderY > avgElbowY && isPullingUp) {
    
        if(!isUp){
            isUp = true;
        } else {
            pullUpCount++;
            if(ST1Id){
                clearTimeout(ST1Id);
            }

            IsDoingEx();            
        }
        repsCountEl.textContent = pullUpCount;
        isPullingUp = false;
    }

    video.playbackRate = 1;
}

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
    summText.textContent = `You have performed ${pullUpCount} reps of pull-ups in this video. Keep going!`;
});

playAgain.addEventListener("click", () => {   
    console.log("again clicked"); 
    video.play();
    toggleButtons();
    pullUpCount = 0;
    repsCountEl.textContent = pullUpCount;
});

startPoseTracking();






