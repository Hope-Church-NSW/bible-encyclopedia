(function () {
    const VERSES = [
        { book: '19-Psalms', chapter: 23, verse: 1, arBook: 'المزامير', enBook: 'Psalms', ar: 'الرَّبُّ رَاعِيَّ فَلاَ يُعْوِزُنِي شَيْءٌ.', en: 'The LORD is my shepherd; I shall not want.' },
        { book: '19-Psalms', chapter: 46, verse: 1, arBook: 'المزامير', enBook: 'Psalms', ar: 'اَللهُ لَنَا مَلْجَأٌ وَقُوَّةٌ. عَوْنًا فِي الضِّيْقَاتِ وُجِدَ شَدِيدًا.', en: 'God is our refuge and strength, a very present help in trouble.' },
        { book: '19-Psalms', chapter: 119, verse: 105, arBook: 'المزامير', enBook: 'Psalms', ar: 'سِرَاجٌ لِرِجْلِي كَلاَمُكَ وَنُورٌ لِسَبِيلِي.', en: 'Thy word is a lamp unto my feet, and a light unto my path.' },
        { book: '20-Proverbs', chapter: 3, verse: 5, arBook: 'الأمثال', enBook: 'Proverbs', ar: 'تَوَكَّلْ عَلَى الرَّبِّ بِكُلِّ قَلْبِكَ، وَعَلَى فَهْمِكَ لاَ تَعْتَمِدْ.', en: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },
        { book: '23-Isiah', chapter: 40, verse: 31, arBook: 'إشعياء', enBook: 'Isaiah', ar: 'وَأَمَّا مُنْتَظِرُو الرَّبِّ فَيُجَدِّدُونَ قُوَّةً. يَرْفَعُونَ أَجْنِحَةً كَالنُّسُورِ. يَرْكُضُونَ وَلاَ يَتْعَبُونَ. يَمْشُونَ وَلاَ يُعْيُونَ.', en: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
        { book: '24-Jeremiah', chapter: 29, verse: 11, arBook: 'إرميا', enBook: 'Jeremiah', ar: 'لأَنِّي عَرَفْتُ الأَفْكَارَ الَّتِي أَنَا مُفْتَكِرٌ بِهَا عَنْكُمْ، يَقُولُ الرَّبُّ، أَفْكَارَ سَلاَمٍ لاَ شَرّ، لأُعْطِيَكُمْ آخِرَةً وَرَجَاءً.', en: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
        { book: '40-Matthew', chapter: 11, verse: 28, arBook: 'متى', enBook: 'Matthew', ar: 'تَعَالَوْا إِلَيَّ يَا جَمِيعَ الْمُتْعَبِينَ وَالثَّقِيلِي الأَحْمَالِ، وَأَنَا أُرِيحُكُمْ.', en: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
        { book: '43-John', chapter: 3, verse: 16, arBook: 'يوحنا', enBook: 'John', ar: 'لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ، لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ، بَلْ تَكُونُ لَهُ الْحَيَاةُ الأَبَدِيَّةُ.', en: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
        { book: '43-John', chapter: 8, verse: 12, arBook: 'يوحنا', enBook: 'John', ar: 'ثُمَّ كَلَّمَهُمْ يَسُوعُ أَيْضًا قَائِلاً:«أَنَا هُوَ نُورُ الْعَالَمِ. مَنْ يَتْبَعْنِي فَلاَ يَمْشِي فِي الظُّلْمَةِ بَلْ يَكُونُ لَهُ نُورُ الْحَيَاةِ».', en: 'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.' },
        { book: '45-Romans', chapter: 8, verse: 28, arBook: 'رومية', enBook: 'Romans', ar: 'وَنَحْنُ نَعْلَمُ أَنَّ كُلَّ الأَشْيَاءِ تَعْمَلُ مَعًا لِلْخَيْرِ لِلَّذِينَ يُحِبُّونَ اللهَ، الَّذِينَ هُمْ مَدْعُوُّونَ حَسَبَ قَصْدِهِ.', en: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
        { book: '50-Philipians', chapter: 4, verse: 6, arBook: 'فيلبي', enBook: 'Philippians', ar: 'لاَ تَهْتَمُّوا بِشَيْءٍ، بَلْ فِي كُلِّ شَيْءٍ بِالصَّلاَةِ وَالدُّعَاءِ مَعَ الشُّكْرِ، لِتُعْلَمْ طِلْبَاتُكُمْ لَدَى اللهِ.', en: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
        { book: '50-Philipians', chapter: 4, verse: 13, arBook: 'فيلبي', enBook: 'Philippians', ar: 'أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ الَّذِي يُقَوِّينِي.', en: 'I can do all things through Christ which strengtheneth me.' },
        { book: '58-Hebrews', chapter: 11, verse: 1, arBook: 'العبرانيين', enBook: 'Hebrews', ar: 'وَأَمَّا الإِيمَانُ فَهُوَ الثِّقَةُ بِمَا يُرْجَى وَالإِيقَانُ بِأُمُورٍ لاَ تُرَى.', en: 'Faith is the substance of things hoped for, the evidence of things not seen.' },
        { book: '60-1-peter', chapter: 5, verse: 7, arBook: 'بطرس الأولى', enBook: '1 Peter', ar: 'مُلْقِينَ كُلَّ هَمِّكُمْ عَلَيْهِ، لأَنَّهُ هُوَ يَعْتَنِي بِكُمْ.', en: 'Casting all your care upon him; for he careth for you.' }
    ];
    const UI = {
        ar: { title: 'آية اليوم', like: '♡ إعجاب', liked: '♥ تم الإعجاب', share: '↗ مشاركة', more: '⋯ المزيد', chapter: '📖 اقرأ الأصحاح', image: '🖼 اصنعها في صورة', designer: 'اصنع آية اليوم في صورة', blue: 'أزرق', sunrise: 'شروق', nature: 'طبيعة', upload: 'اختر صورة', download: 'تنزيل الصورة', shareImage: 'مشاركة الصورة', shared: 'تمت المشاركة.', copied: 'تم نسخ الآية.', saved: 'تم إنشاء الصورة.', brand: 'موسوعة الكتاب المقدس' },
        en: { title: 'Verse of the Day', like: '♡ Like', liked: '♥ Liked', share: '↗ Share', more: '⋯ More', chapter: '📖 Read Chapter', image: '🖼 Create Image', designer: 'Create a Verse Image', blue: 'Blue', sunrise: 'Sunrise', nature: 'Nature', upload: 'Choose Photo', download: 'Download Image', shareImage: 'Share Image', shared: 'Shared successfully.', copied: 'Verse copied.', saved: 'Image created.', brand: 'Bible Encyclopedia' }
    };
    const now = new Date();
    const dayNumber = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
    const dailyVerse = VERSES[((dayNumber % VERSES.length) + VERSES.length) % VERSES.length];
    let language = localStorage.getItem('bibleAppLanguage') === 'en' ? 'en' : 'ar';
    let background = 'navy';
    let uploadedImage = null;

    function reference() {
        return `${language === 'en' ? dailyVerse.enBook : dailyVerse.arBook} ${dailyVerse.chapter}:${dailyVerse.verse}`;
    }

    function verseText() {
        return language === 'en' ? dailyVerse.en : dailyVerse.ar;
    }

    function likeKey() {
        return `dailyVerseLiked:${dailyVerse.book}:${dailyVerse.chapter}:${dailyVerse.verse}`;
    }

    function setStatus(message) {
        const status = document.getElementById('dailyVerseStatus');
        if (status) status.textContent = message;
    }

    window.renderDailyVerse = function (nextLanguage) {
        language = nextLanguage === 'en' ? 'en' : 'ar';
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
        [text.blue, text.sunrise, text.nature].forEach((label, index) => { backgrounds[index].textContent = label; });
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
        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        const colors = {
            navy: ['#061b3a', '#0b4f83'],
            sunrise: ['#4b2142', '#d97745'],
            forest: ['#0b332c', '#2f6b4f']
        }[background];
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
        context.direction = language === 'en' ? 'ltr' : 'rtl';
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
}());
