document.addEventListener('DOMContentLoaded', function() {
    const uploadBtn = document.querySelector('.action-card .action-icon.add-multiple').parentElement;

    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            createUploadModal();
        });
    }

    function createUploadModal() {
        // Remove existing modal if any
        const existingModal = document.querySelector('.upload-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'upload-modal';
        modal.innerHTML = `
            <div class="upload-modal-content">
                <div class="upload-modal-header">
                    <h2>Upload Subjects Excel Sheet</h2>
                    <button class="close-modal" onclick="closeUploadModal()">&times;</button>
                </div>
                <div class="upload-modal-body">
                    <p>Please upload an Excel file with columns: Subject Name, Type (Core/Elective)</p>
                    <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display: none;">
                    <div id="dragDropArea">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 48px; color: #6200ea; margin-bottom: 16px;"></i>
                        <h3>Drag & Drop or Click to Upload</h3>
                        <p>Supported formats: .xlsx, .xls</p>
                    </div>
                    <button id="uploadBtn" class="btn btn-primary" style="display: none;">Upload Subjects</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add styles if not present
        if (!document.getElementById('upload-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'upload-modal-styles';
            style.textContent = `
                .upload-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10001;
                    backdrop-filter: blur(4px);
                }
                .upload-modal-content {
                    background: white;
                    padding: 32px;
                    border-radius: 16px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
                .upload-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .upload-modal-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1e293b;
                }
                .close-modal {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                }
                .upload-modal-body p {
                    color: #64748b;
                    margin-bottom: 12px;
                }
                #dragDropArea {
                    border: 2px dashed #e2e8f0;
                    border-radius: 12px;
                    padding: 40px;
                    text-align: center;
                    margin: 20px 0;
                    transition: all 0.3s;
                    background: #f8fafc;
                    cursor: pointer;
                }
                #dragDropArea:hover, #dragDropArea.drag-over {
                    border-color: #6200ea;
                    background-color: #ede7f6;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .btn-primary {
                    background-color: #6200ea;
                    color: white;
                }
                .btn-primary:hover {
                    background-color: #5a00d8;
                }
            `;
            document.head.appendChild(style);
        }

        const dragDropArea = document.getElementById('dragDropArea');
        const fileInput = document.getElementById('excelFileInput');
        const uploadBtn = document.getElementById('uploadBtn');

        dragDropArea.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        // Drag and drop functionality
        dragDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropArea.classList.add('drag-over');
        });

        dragDropArea.addEventListener('dragleave', () => {
            dragDropArea.classList.remove('drag-over');
        });

        dragDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (file) {
                await processExcelFile(file);
            }
        });
    }

    function handleFileUpload(file) {
        const uploadBtn = document.getElementById('uploadBtn');
        const dragDropArea = document.getElementById('dragDropArea');

        dragDropArea.innerHTML = `
            <i class="fa-solid fa-file-excel" style="font-size: 48px; color: #217346; margin-bottom: 16px;"></i>
            <h3>${file.name}</h3>
            <p>File selected. Click Upload to proceed.</p>
        `;
        uploadBtn.style.display = 'block';
    }

    async function processExcelFile(file) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const subjects = jsonData.map(row => {
                const name = row['Subject Name'] || row['subject name'] || row['Name'] || row['name'];
                const type = row['Type'] || row['type'] || row['Subject Type'] || row['subject type'];

                if (!name || !type) {
                    throw new Error('Excel file must have columns: Subject Name and Type (Core/Elective)');
                }

                const isCore = type.toLowerCase() === 'core';

                return {
                    subject_name: name.trim(),
                    is_core: isCore
                };
            });

            const { data: insertedData, error } = await window.supabase
                .from('Subjects')
                .insert(subjects);

            if (error) {
                console.error('Error inserting subjects:', error);
                alert('Failed to upload subjects. Please check the Excel file format.');
            } else {
                console.log('Subjects uploaded successfully:', insertedData);
                alert(`${subjects.length} subjects uploaded successfully!`);
                closeUploadModal();
            }
        } catch (err) {
            console.error('Error processing Excel file:', err);
            alert('Error processing the Excel file. Please ensure it has the correct format.');
        }
    }

    window.closeUploadModal = function() {
        const modal = document.querySelector('.upload-modal');
        if (modal) {
            modal.remove();
        }
    };
});
