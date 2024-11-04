import JSZip from 'jszip';
import { convertToMp3, convertToWav } from './utils/audioConverter.js';
import { getAllFiles } from './utils/fileSystem.js';
import { createAlbumCard } from './components/AlbumCard.js';

class AudioConverter {
    constructor() {
        this.albums = new Map();
        this.activeConversions = new Set();
        this.maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB limit

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.setupDropZone();
        this.setupBatchControls();
    }

    setupBatchControls() {
        const batchControls = document.getElementById('batchControls');
        if (!batchControls) return; // Guard clause for missing element

        const batchMp3 = document.getElementById('batchMp3');
        const batchWav = document.getElementById('batchWav');

        if (batchMp3) {
            batchMp3.addEventListener('click', () => this.convertAllAlbums('mp3'));
        }
        if (batchWav) {
            batchWav.addEventListener('click', () => this.convertAllAlbums('wav'));
        }
        
        this.updateBatchControlsVisibility();
    }

    updateBatchControlsVisibility() {
        const batchControls = document.getElementById('batchControls');
        if (!batchControls) return; // Guard clause for missing element

        if (this.albums && this.albums.size > 1) {
            batchControls.classList.remove('hidden');
        } else {
            batchControls.classList.add('hidden');
        }
    }

    async convertAllAlbums(format) {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => btn.disabled = true);

        try {
            for (const [albumName] of this.albums) {
                if (!this.activeConversions.has(albumName)) {
                    const card = document.querySelector(`[data-album-name="${albumName}"]`);
                    if (card) {
                        try {
                            // Get UI elements
                            const progress = card.querySelector('.progress-bar');
                            const progressText = card.querySelector('.text-xs');
                            const progressBar = card.querySelector('.progress-bar-fill');
                            const statusText = card.querySelector('.status-text');
                            const statusSpinner = card.querySelector('.status-spinner');
                            const status = statusText.parentElement;

                            // Show progress elements
                            progress.classList.remove('hidden');
                            progressText.classList.remove('hidden');
                            statusSpinner.classList.remove('hidden');
                            statusText.textContent = 'Converting files...';
                            status.classList.add('converting');

                            // Start conversion
                            await this.convertAlbum(albumName, format, (percent) => {
                                progressBar.style.width = `${percent}%`;
                                progressText.textContent = `${percent}%`;
                                
                                if (percent === 100) {
                                    statusText.textContent = 'Preparing download...';
                                }
                            });

                            // Show completion status
                            statusText.textContent = 'Conversion complete!';
                            statusSpinner.classList.add('hidden');
                            status.classList.remove('converting');

                            // Reset UI after delay
                            setTimeout(() => {
                                progress.classList.add('hidden');
                                progressText.classList.add('hidden');
                                statusText.textContent = 'Ready to convert';
                            }, 2000);

                        } catch (error) {
                            console.error(`Error converting ${albumName}:`, error);
                            const statusText = card.querySelector('.status-text');
                            const statusSpinner = card.querySelector('.status-spinner');
                            const status = statusText.parentElement;
                            
                            statusText.textContent = 'Conversion failed';
                            statusSpinner.classList.add('hidden');
                            status.classList.remove('converting');
                        }
                    }
                }
                // Wait a bit between albums to prevent overwhelming the browser
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } finally {
            buttons.forEach(btn => btn.disabled = false);
        }
    }

    setupDropZone() {
        const dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('drop', async (e) => {
            const items = Array.from(e.dataTransfer.items);
            const directories = items.filter(item => 
                item.kind === 'file' && 
                item.webkitGetAsEntry()?.isDirectory
            );

            // Process all directories concurrently
            await Promise.all(
                directories.map(item => 
                    this.processDirectory(item.webkitGetAsEntry())
                )
            );
            
            // Update batch controls after all directories are processed
            this.updateBatchControlsVisibility();
        });
    }

    async processDirectory(dirEntry) {
        const files = await getAllFiles(dirEntry);
        const audioFiles = files.filter(file => {
            if (file.size > this.maxFileSize) {
                console.warn(`File ${file.name} exceeds size limit of 2GB`);
                return false;
            }
            return file.name.toLowerCase().endsWith('.mp3') ||
                   file.name.toLowerCase().endsWith('.wav');
        });

        if (audioFiles.length > 0) {
            // First store the files in the albums Map
            this.albums.set(dirEntry.name, audioFiles);

            // Then create the card with the conversion callback
            const albumCard = createAlbumCard(
                dirEntry.name, 
                async (albumName, format, updateProgress) => {
                    return this.convertAlbum(albumName, format, updateProgress);
                }
            );
            
            document.getElementById('albumGrid').appendChild(albumCard);
            this.updateBatchControlsVisibility();
        }
    }

    async convertAlbum(albumName, format, updateProgress) {
        if (this.activeConversions.has(albumName)) {
            throw new Error('Conversion already in progress');
        }

        this.activeConversions.add(albumName);
        const files = this.albums.get(albumName);
        const zip = new JSZip();
        const folder = zip.folder(albumName);
        const totalFiles = files.length;
        let processedFiles = 0;

        try {
            for (const file of files) {
                let arrayBuffer = await this.safeArrayBuffer(file);
                if (!arrayBuffer) continue;

                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                try {
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    
                    if (format === 'auto' || format === 'mp3') {
                        const mp3Data = await convertToMp3(audioBuffer, (chunkProgress) => {
                            const fileProgress = (processedFiles / totalFiles);
                            const chunkContribution = (1 / totalFiles) * chunkProgress;
                            updateProgress(Math.round((fileProgress + chunkContribution) * 100));
                        });
                        const mp3FileName = file.name.replace(/\.[^/.]+$/, '') + '.mp3';
                        folder.file(mp3FileName, mp3Data);
                    }
                    
                    if (format === 'auto' || format === 'wav') {
                        const wavData = await convertToWav(audioBuffer, (chunkProgress) => {
                            const fileProgress = (processedFiles / totalFiles);
                            const chunkContribution = (1 / totalFiles) * chunkProgress;
                            updateProgress(Math.round((fileProgress + chunkContribution) * 100));
                        });
                        const wavFileName = file.name.replace(/\.[^/.]+$/, '') + '.wav';
                        folder.file(wavFileName, wavData);
                    }

                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                    continue;
                } finally {
                    audioContext.close();
                    // Now we can safely reassign
                    arrayBuffer = null;
                }

                processedFiles++;
                updateProgress(Math.round((processedFiles / totalFiles) * 100));
                
                // Yield to main thread between files
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Generate zip in chunks
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
                streamFiles: true
            }, (metadata) => {
                updateProgress(Math.round(metadata.percent));
            });

            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${albumName}_${format === 'auto' ? 'all' : format}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        } finally {
            this.activeConversions.delete(albumName);
        }
    }

    async safeArrayBuffer(file) {
        try {
            return await file.arrayBuffer();
        } catch (error) {
            console.error(`Error reading file ${file.name}:`, error);
            return null;
        }
    }
}

new AudioConverter();