export function createAlbumCard(albumName, onConvert) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('data-album-name', albumName);
    
    const header = document.createElement('div');
    header.className = 'mb-6';
    
    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-gray-200 mb-2';
    title.textContent = albumName;
    
    const status = document.createElement('div');
    status.className = 'text-sm text-gray-400 flex items-center gap-2';
    status.innerHTML = `
        <span class="status-text">Ready to convert</span>
        <div class="status-spinner hidden">
            <svg class="animate-spin h-4 w-4 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
    `;
    
    const statusText = status.querySelector('.status-text');
    const statusSpinner = status.querySelector('.status-spinner');
    
    const progress = document.createElement('div');
    progress.className = 'progress-bar mt-2 hidden';
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-bar-fill';
    progressFill.style.width = '0%';
    progress.appendChild(progressFill);
    
    const progressText = document.createElement('div');
    progressText.className = 'text-xs text-gray-500 mt-1 hidden';
    progressText.textContent = '0%';
    
    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(progress);
    header.appendChild(progressText);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'space-y-3';
    
    const autoConvertBtn = createButton('Convert All Formats', 'btn-primary', () => startConversion('auto'));
    const mp3Btn = createButton('Convert to MP3', 'btn-secondary', () => startConversion('mp3'));
    const wavBtn = createButton('Convert to WAV', 'btn-tertiary', () => startConversion('wav'));
    
    buttonContainer.appendChild(autoConvertBtn);
    buttonContainer.appendChild(mp3Btn);
    buttonContainer.appendChild(wavBtn);
    
    card.appendChild(header);
    card.appendChild(buttonContainer);

    function createButton(text, className, onClick) {
        const button = document.createElement('button');
        button.className = `btn ${className}`;
        button.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            ${text}
        `;
        button.addEventListener('click', onClick);
        return button;
    }

    async function startConversion(format) {
        const buttons = buttonContainer.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
        
        progress.classList.remove('hidden');
        progressText.classList.remove('hidden');
        statusSpinner.classList.remove('hidden');
        statusText.textContent = 'Converting files...';
        status.classList.add('converting');
        
        try {
            const updateProgress = (percent) => {
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
                
                if (percent === 100) {
                    statusText.textContent = 'Preparing download...';
                }
            };

            await onConvert(albumName, format, updateProgress);
            
            statusText.textContent = 'Conversion complete!';
            statusSpinner.classList.add('hidden');
            status.classList.remove('converting');
            
            setTimeout(() => {
                progress.classList.add('hidden');
                progressText.classList.add('hidden');
                buttons.forEach(btn => btn.disabled = false);
                statusText.textContent = 'Ready to convert';
            }, 2000);

        } catch (error) {
            statusText.textContent = 'Conversion failed';
            statusSpinner.classList.add('hidden');
            status.classList.remove('converting');
            progress.classList.add('hidden');
            progressText.classList.add('hidden');
            buttons.forEach(btn => btn.disabled = false);
        }
    }
    
    return card;
}