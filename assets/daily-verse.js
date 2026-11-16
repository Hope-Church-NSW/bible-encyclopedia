import { getDailyVerseForDate } from './daily-verses.mjs';

(function () {

    const UI = {
        ar: { title: 'آية اليوم', like: '♡ إعجاب', liked: '♥ تم الإعجاب', share: '↗ مشاركة', more: '⋯ المزيد', chapter: '📖 اقرأ الأصحاح', image: '🖼 اصنعها في صورة', designer: 'اصنع آية اليوم في صورة', sky: 'سماء وسحاب', sunrise: 'شروق', trees: 'أشجار', upload: 'أضف صورتك', download: 'تنزيل الصورة', shareImage: 'مشاركة الصورة', shared: 'تمت المشاركة.', copied: 'تم نسخ الآية.', saved: 'تم إنشاء الصورة.', brand: 'موسوعة الكتاب المقدس' },
        en: { title: 'Verse of the Day', like: '♡ Like', liked: '♥ Liked', share: '↗ Share', more: '⋯ More', chapter: '📖 Read Chapter', image: '🖼 Create Image', designer: 'Create a Verse Image', sky: 'Sky & Clouds', sunrise: 'Sunrise', trees: 'Trees', upload: 'Add Your Photo', download: 'Download Image', shareImage: 'Share Image', shared: 'Shared successfully.', copied: 'Verse copied.', saved: 'Image created.', brand: 'Bible Encyclopedia' },
        es: { title: 'Versículo del día', like: '♡ Me gusta', liked: '♥ Te gusta', share: '↗ Compartir', more: '⋯ Más', chapter: '📖 Leer el capítulo', image: '🖼 Crear imagen', designer: 'Crear una imagen del versículo', sky: 'Cielo y nubes', sunrise: 'Amanecer', trees: 'Árboles', upload: 'Añada su foto', download: 'Descargar imagen', shareImage: 'Compartir imagen', shared: 'Compartido correctamente.', copied: 'Versículo copiado.', saved: 'Imagen creada.', brand: 'Enciclopedia Bíblica' },
        fr: { title: 'Verset du jour', like: '♡ J’aime', liked: '♥ Aimé', share: '↗ Partager', more: '⋯ Plus', chapter: '📖 Lire le chapitre', image: '🖼 Créer une image', designer: 'Créer une image du verset', sky: 'Ciel et nuages', sunrise: 'Lever du soleil', trees: 'Arbres', upload: 'Ajouter votre photo', download: 'Télécharger l’image', shareImage: 'Partager l’image', shared: 'Partagé avec succès.', copied: 'Verset copié.', saved: 'Image créée.', brand: 'Encyclopédie biblique' }
    };
    const BACKGROUND_SOURCES = {
        sky: 'assets/verse-backgrounds/sky-clouds.svg',
        sunrise: 'assets/verse-backgrounds/sunrise.svg',
        trees: 'assets/verse-backgrounds/trees.svg'
    };
    const backgroundImages = {};
    const dailyVerse = getDailyVerseForDate();
    const storedLanguage = localStorage.getItem('bibleAppLanguage');
    let language = ['ar', 'en', 'es', 'fr'].includes(storedLanguage) ? storedLanguage : 'ar';
    let background = 'sky';
    let uploadedImage = null;

    Object.entries(BACKGROUND_SOURCES).forEach(([name, source]) => {
        const image = new Image();
        image.addEventListener('load', () => {
            if (!uploadedImage && background === name) drawDailyVerseImage();
        });
        image.addEventListener('error', () => {
            console.error(`Unable to load verse background: ${source}`);
        });
        image.src = source;
        backgroundImages[name] = image;
    });

    function reference() {
        return `${dailyVerse.names[language]} ${dailyVerse.chapter}:${dailyVerse.verse}`;
    }

    function verseText() {
        return dailyVerse.text[language];
    }

    function likeKey() {
        return `dailyVerseLiked:${dailyVerse.book}:${dailyVerse.chapter}:${dailyVerse.verse}`;
    }

    function setStatus(message) {
        const status = document.getElementById('dailyVerseStatus');
        if (status) status.textContent = message;
    }

    window.renderDailyVerse = function (nextLanguage) {
        language = ['ar', 'en', 'es', 'fr'].includes(nextLanguage) ? nextLanguage : 'ar';
        const text = UI[language];
        document.getElementById('dailyVerseTitle').textContent = text.title;
        document.getElementById('dailyVerseText').textContent = `“${verseText()}”`;
        document.getElementById('dailyVerseReference').textContent = reference();
        const liked = localStorage.getItem(likeKey()) === '1';
        const like = document.getElementById('dailyVerseLike');
        like.textContent = liked ? text.liked : text.like;
        like.classList.toggle('is-liked', liked);
        document.getElementById('dailyVerseShare').textContent = text.share;
        document.getElementById('dailyVerseMore').textContent = text.more;
        document.getElementById('dailyVerseChapter').textContent = text.chapter;
        document.getElementById('dailyVerseChapter').href = `bible.html?book=${encodeURIComponent(dailyVerse.book)}&chapter=${dailyVerse.chapter}`;
        document.getElementById('dailyVerseImage').textContent = text.image;
        document.getElementById('verseImageTitle').textContent = text.designer;
        const backgrounds = document.querySelectorAll('.verse-background-button');
        [text.sky, text.sunrise, text.trees].forEach((label, index) => { backgrounds[index].textContent = label; });
        document.querySelector('.verse-upload-label').childNodes[0].nodeValue = text.upload;
        document.getElementById('dailyVerseDownload').textContent = text.download;
        document.getElementById('dailyVerseImageShare').textContent = text.shareImage;
        setStatus('');
        drawDailyVerseImage();
    };

    window.toggleDailyVerseLike = function () {
        const liked = localStorage.getItem(likeKey()) !== '1';
        localStorage.setItem(likeKey(), liked ? '1' : '0');
        window.renderDailyVerse(language);
    };

    window.toggleDailyVerseMenu = function () {
        const menu = document.getElementById('dailyVerseMenu');
        const button = document.getElementById('dailyVerseMore');
        menu.hidden = !menu.hidden;
        button.setAttribute('aria-expanded', String(!menu.hidden));
    };

    window.shareDailyVerse = async function () {
        const shareText = `${verseText()}\n${reference()}`;
        if (navigator.share) {
            await navigator.share({ title: UI[language].title, text: shareText });
            setStatus(UI[language].shared);
            return;
        }
        await navigator.clipboard.writeText(shareText);
        setStatus(UI[language].copied);
    };

    function wrapText(context, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach((word) => {
            const candidate = line ? `${line} ${word}` : word;
            if (line && context.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        if (line) lines.push(line);
        return lines;
    }

    function drawBackground(context, canvas) {
        if (uploadedImage) {
            const scale = Math.max(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height);
            const width = uploadedImage.width * scale;
            const height = uploadedImage.height * scale;
            context.drawImage(uploadedImage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
            context.fillStyle = 'rgba(2,14,28,.58)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const selectedImage = backgroundImages[background];
        if (selectedImage && selectedImage.complete && selectedImage.naturalWidth) {
            const scale = Math.max(canvas.width / selectedImage.naturalWidth, canvas.height / selectedImage.naturalHeight);
            const width = selectedImage.naturalWidth * scale;
            const height = selectedImage.naturalHeight * scale;
            context.drawImage(selectedImage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
            context.fillStyle = 'rgba(2,14,28,.42)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        const colors = {
            sky: ['#2989d8', '#eaf7ff'],
            sunrise: ['#4b2142', '#d97745'],
            trees: ['#89c9cf', '#214f3b']
        }[background] || ['#061b3a', '#0b4f83'];
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawDailyVerseImage() {
        const canvas = document.getElementById('dailyVerseCanvas');
        if (!canvas) return;
        const context = canvas.getContext('2d');
        drawBackground(context, canvas);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.direction = language === 'ar' ? 'rtl' : 'ltr';
        context.fillStyle = '#f4dc78';
        context.font = 'bold 42px Tahoma';
        context.fillText(UI[language].title, 540, 120);
        const fontSize = verseText().length > 150 ? 52 : verseText().length > 90 ? 60 : 70;
        context.fillStyle = '#ffffff';
        context.font = `bold ${fontSize}px Tahoma`;
        const lines = wrapText(context, verseText(), 860);
        const lineHeight = fontSize * 1.55;
        const startY = 500 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => context.fillText(line, 540, startY + index * lineHeight));
        context.fillStyle = '#f4dc78';
        context.font = 'bold 42px Tahoma';
        context.fillText(reference(), 540, 840);
        context.fillStyle = 'rgba(255,255,255,.9)';
        context.font = 'bold 28px Tahoma';
        context.fillText(UI[language].brand, 540, 980);
    }

    window.openDailyVerseDesigner = function () {
        document.getElementById('dailyVerseMenu').hidden = true;
        document.getElementById('dailyVerseMore').setAttribute('aria-expanded', 'false');
        document.getElementById('verseImageBackdrop').hidden = false;
        document.body.style.overflow = 'hidden';
        drawDailyVerseImage();
    };

    window.closeDailyVerseDesigner = function () {
        document.getElementById('verseImageBackdrop').hidden = true;
        document.body.style.overflow = '';
    };

    function imageBlob() {
        return new Promise((resolve, reject) => {
            document.getElementById('dailyVerseCanvas').toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Unable to create verse image.'));
            }, 'image/png');
        });
    }

    window.downloadDailyVerseImage = async function () {
        const blob = await imageBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `verse-${dailyVerse.chapter}-${dailyVerse.verse}.png`;
        link.click();
        URL.revokeObjectURL(url);
        setStatus(UI[language].saved);
    };

    window.shareDailyVerseImage = async function () {
        const blob = await imageBlob();
        const file = new File([blob], 'verse-of-the-day.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: UI[language].title, files: [file] });
            setStatus(UI[language].shared);
            return;
        }
        window.downloadDailyVerseImage();
    };

    document.addEventListener('click', (event) => {
        const more = document.querySelector('.daily-verse-more');
        if (more && !more.contains(event.target)) {
            document.getElementById('dailyVerseMenu').hidden = true;
            document.getElementById('dailyVerseMore').setAttribute('aria-expanded', 'false');
        }
    });

    document.querySelectorAll('.verse-background-button').forEach((button) => {
        button.addEventListener('click', () => {
            uploadedImage = null;
            background = button.dataset.verseBackground;
            document.querySelectorAll('.verse-background-button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
            drawDailyVerseImage();
        });
    });

    document.getElementById('dailyVerseBackgroundUpload').addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            const image = new Image();
            image.addEventListener('load', () => {
                uploadedImage = image;
                document.querySelectorAll('.verse-background-button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
                drawDailyVerseImage();
            });
            image.src = reader.result;
        });
        reader.readAsDataURL(file);
    });

    window.renderDailyVerse(language);
}());
