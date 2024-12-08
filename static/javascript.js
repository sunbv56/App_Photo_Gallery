const API_BASE_URL = 'http://13.215.176.72:5000';
const BUCKET_URL = 'https://my-image-bucket-tbt1711.s3.amazonaws.com/Images/';
let selectedFiles = [];
let stream;
let currentPage = 1;
let totalPages = 1;
let currentToken = null;

// Login/Registration Popup Logic
function showLoginPopup() {
    document.getElementById('login-overlay').style.display = 'flex';
}

function hideLoginPopup() {
    document.getElementById('login-overlay').style.display = 'none';
}

// Toggle between login and register forms
document.getElementById('toggle-form').addEventListener('click', function() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'flex';
    document.getElementById('form-title').textContent = 'Register';
});

document.getElementById('toggle-login-form').addEventListener('click', function() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
    document.getElementById('form-title').textContent = 'Login';
});

// File upload handler
document.getElementById('file-input').addEventListener('change', function(e) {
    const username = validateUsername();
    if (username) {
        selectedFiles = Array.from(e.target.files);
        uploadFiles(username);
    }
});

// Login Form Submit
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.token;
            localStorage.setItem('token', currentToken);
            hideLoginPopup();
            listImages(); // Reload images after login
        } else {
            errorMessage.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'An error occurred during login';
    }
});

// Registration Form Submit
document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorMessage = document.getElementById('register-error-message');

    if (password !== confirmPassword) {
        errorMessage.textContent = 'Passwords do not match';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Registration successful! Please login.');
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'flex';
        } else {
            errorMessage.textContent = data.error || 'Registration failed';
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorMessage.textContent = 'An error occurred during registration';
    }
});

// Validate username before performing actions
function validateUsername() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return false;
    }
    return username;
}

// Camera functions
async function openCamera() {
    const cameraView = document.getElementById('camera-view');
    const video = document.getElementById('video');
    cameraView.style.display = 'flex';
    
    try {
        // Yêu cầu quyền truy cập vào camera
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment' // Sử dụng camera sau (nếu có)
            }
        });

        // Nếu quyền truy cập camera được cấp, thiết lập video source
        video.srcObject = stream;

    } catch (err) {
        // Xử lý khi quyền truy cập bị từ chối hoặc có lỗi
        console.error("Error accessing camera:", err);
        if (err.name === 'NotAllowedError') {
            alert('You need to grant permission to access the camera.');
        } else if (err.name === 'NotFoundError') {
            alert('No camera found on this device.');
        } else {
            alert('An error occurred while accessing the camera.');
        }

        cameraView.style.display = 'none'; // Ẩn camera view nếu lỗi
    }
}

function capturePhoto() {
    const username = validateUsername();
    if (!username) return;

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const capturedPhoto = document.getElementById('captured-photo');
    const context = canvas.getContext('2d');
    

    // Đảm bảo canvas và video chiếm toàn màn hình
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    capturedPhoto.src = canvas.toDataURL('image/jpeg');
    video.style.display = 'none';
    capturedPhoto.style.display = 'block';

    const now = new Date();
    const fileName = `${username}_${now.toISOString().replace(/:/g, '-')}.jpg`;

    canvas.toBlob(blob => {
        const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });
        uploadCapturedPhoto(capturedFile, username);
    });
}

// Cancel Camera function
function cancelCamera() {
    // Stop the video stream
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }

    // Hide the camera view
    const cameraView = document.getElementById('camera-view');
    const video = document.getElementById('video');
    video.srcObject = null;  // Reset the video source
    cameraView.style.display = 'none';
}

async function uploadCapturedPhoto(file, username) {
    selectedFiles = [file];
    await uploadFiles(username);
    closeCamera();
}

function closeCamera() {
    const cameraView = document.getElementById('camera-view');
    const video = document.getElementById('video');
    const capturedPhoto = document.getElementById('captured-photo');
    
    cameraView.style.display = 'none';
    video.style.display = 'block';
    capturedPhoto.style.display = 'none';

    // Stop video stream
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
}

async function uploadFiles(username) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
        return;
    }

    if (selectedFiles.length === 0) {
        alert('Please select files to upload');
        return;
    }

    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        // formData.append('username', username);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': token
                },
                body: formData
            });

            progressBar.style.width = `${((i + 1) / selectedFiles.length) * 100}%`;

            if (!response.ok) {
                throw new Error('Upload failed');
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                showLoginPopup();
            }else{
                console.error('Upload error:', error);
                alert(`Failed to upload ${file.name}`);
            }
        }
    }

    // alert('Upload successful!');

    setTimeout(() => {
        progressContainer.style.display = 'none';
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = '';
        listImages();
        selectedFiles = [];
        document.getElementById('file-input').value = '';
    }, 2000);
}

// Hàm listImages được sửa đổi để hỗ trợ phân trang
async function listImages() {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
        return;
    }
    
    // Giải mã token để lấy user_id
    let user_id = null;
    try {
        const decodedToken = jwt_decode(token);  // Dùng thư viện jwt-decode để giải mã token
        user_id = decodedToken.user_id;  // Lấy user_id từ token
    } catch (error) {
        console.error('Error decoding token:', error);
        alert('Invalid or expired token');
        return;
    }

    const gallery = document.getElementById('gallery');
    const currentPageSpan = document.getElementById('current-page');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    try {
        // Thêm token vào Authorization header, không cần truyền username
        const response = await fetch(`${API_BASE_URL}/list?page=${currentPage}`, {
            method: 'GET',
            headers: {
                'Authorization': token,
            },
        });

        // Kiểm tra xem response có thành công hay không
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error from API:', errorData);
            alert(`Error: ${errorData.error || 'An error occurred while listing images'}`);
            return;
        }

        // Nếu thành công, xử lý dữ liệu
        const data = await response.json();

        totalPages = data.total_pages;
        currentPageSpan.textContent = `Page ${currentPage}`;

        // Disable nút chuyển trang khi cần
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage === totalPages;

        // Làm trống thư viện ảnh và thêm các ảnh mới
        gallery.innerHTML = '';

        data.files.forEach(file => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item';
            itemDiv.id = `file-${file}`;

            itemDiv.innerHTML = `
                <img src="${BUCKET_URL}${user_id}/${file}" alt="${file}" onclick="showImageDetails('${file}')">
                <div class="gallery-item-details">
                    <span title="${file}">${file}</span>
                    <button class="download-btn" onclick="downloadFile('${file}')">
                        <i class="material-icons">download</i>
                    </button>
                    <button class="delete-btn" onclick="deleteFile('${file}')">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            `;
            gallery.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Error listing images:', error);
        alert('An unexpected error occurred. Please try again later.');
    }
}

// Hàm thay đổi trang
function changePage(direction) {
    currentPage += direction;
    listImages();
}

// Hàm hiển thị chi tiết ảnh
async function showImageDetails(filename) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
        return;
    }
    try {
        console.log(API_BASE_URL, filename, token)
        const response = await fetch(`${API_BASE_URL}/get/${filename}`, {
            method: 'GET',
            headers: {
                'Authorization': token,
            },
        });
        const data = await response.json();

        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const popupFilename = document.getElementById('popup-filename');
        const popupSize = document.getElementById('popup-size');
        const popupType = document.getElementById('popup-type');

        popupImage.src = data.url;
        popupFilename.textContent = `Filename: ${data.filename}`;
        popupSize.textContent = `Size: ${formatFileSize(data.size)}`;
        const fileExtension = filename.substring(filename.lastIndexOf('.') + 1).toUpperCase();  // Lấy phần mở rộng sau dấu chấm cuối cùng
        popupType.textContent = `File Type: ${fileExtension}`;

        popup.style.display = 'flex';
    } catch (error) {
        console.error('Error fetching image details:', error);
        alert('Could not fetch image details');
    }
}

// Hàm đóng popup
function closeImagePopup() {
    const popup = document.getElementById('image-popup');
    popup.style.display = 'none';
}

// Hàm format kích thước file
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    else return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function downloadFile(filename) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/download/${filename}`, {
            method: 'GET',
            headers: {
                'Authorization': token,
            },
        });

        // Kiểm tra phản hồi
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error downloading file:', errorData);
            alert(`Error: ${errorData.error || 'Download failed'}`);
            return;
        }

        const data = await response.json();

        if (data.url) {
            // Tạo link tải xuống và kích hoạt
            const link = document.createElement('a');
            link.href = data.url;
            link.download = filename;
            link.click();
        } else {
            alert('Download failed');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed');
    }
}

async function deleteFile(filename) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
        return;
    }

    // Hiển thị hộp thoại xác nhận trước khi xóa
    const confirmDelete = window.confirm(`Are you sure you want to delete the file: ${filename}?`);

    if (!confirmDelete) {
        // Nếu người dùng nhấn "No", dừng lại và không làm gì
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/delete/${filename}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token,
            },
        });

        // Kiểm tra phản hồi
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error deleting file:', errorData);
            alert(`Error: ${errorData.error || 'Delete failed'}`);
            return;
        }

        const data = await response.json();

        if (data.message) {
            // Xóa phần tử HTML của file đã xóa và cập nhật lại danh sách ảnh
            document.getElementById(`file-${filename}`).remove();
            listImages(); // Cập nhật lại gallery
        } else {
            alert('Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Delete failed');
    }
}

// On page load, check for existing token
function initializePage() {
    // localStorage.setItem('token', '');
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPopup();
    } else {
        currentToken = token;
        listImages();
    }
}

function signOut() {
    // Xóa token khỏi localStorage
    localStorage.removeItem('token');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    listImages();
}

// Replace your existing window.onload or document ready with this
window.onload = initializePage;