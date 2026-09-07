(function () {
    const header = document.querySelector('header, .top-frame, .site-header');

    if (!header) return;

    document.body.classList.add('project-unified-header');

    const returnControl = header.querySelector(
        '.back-button, .back-btn, .home-button, .home-btn, .back-link'
    );
    const riversControl = header.querySelector('.header-rivers-back');
    const logo = header.querySelector('img');
    const returnHref = returnControl ? returnControl.getAttribute('href') : 'studies.html';
    const returnText = returnControl
        ? returnControl.textContent.replace(/[←→⌂]/g, '').trim()
        : 'الدراسات';

    header.className = 'project-header';
    header.replaceChildren();

    const brand = document.createElement('div');
    brand.className = 'project-brand';
    const brandText = document.createElement('div');
    brandText.className = 'project-brand-text';
    const brandName = document.createElement('div');
    brandName.className = 'project-brand-name';
    brandName.textContent = 'موسوعة الكتاب المقدس';
    const brandChurch = document.createElement('div');
    brandChurch.className = 'project-brand-church';
    brandChurch.textContent = 'كنيسة رجاء الأمم سيدني';
    const brandLogo = document.createElement('img');
    brandLogo.className = 'project-brand-logo';
    brandLogo.src = logo ? logo.getAttribute('src') : 'assets/logo.png';
    brandLogo.alt = 'شعار كنيسة رجاء الأمم سيدني';
    brandText.append(brandName, brandChurch);
    brand.append(brandText, brandLogo);

    const actions = document.createElement('div');
    actions.className = 'project-header-actions';

    const back = document.createElement('a');
    back.className = 'project-return';
    back.href = returnHref;
    const backIcon = document.createElement('span');
    backIcon.textContent = '↩';
    const backText = document.createElement('span');
    backText.textContent = returnText || 'الدراسات';
    back.append(backIcon, backText);
    actions.appendChild(back);

    if (riversControl) {
        riversControl.className = 'project-rivers-return';
        actions.appendChild(riversControl);
    }

    if (location.pathname.endsWith('study-biblical-books-introductions.html')) {
        const booksReturn = document.createElement('a');
        booksReturn.className = 'project-books-return';
        booksReturn.href = '#bookIndex';
        booksReturn.textContent = '📖 الأسفار الكتابية';
        actions.appendChild(booksReturn);
    }

    header.append(brand, actions);

    document.querySelectorAll('footer, .footer-note').forEach(function (footer) {
        footer.remove();
    });

    const projectFooter = document.createElement('footer');
    projectFooter.className = 'project-footer';
    projectFooter.innerHTML = '<div>موسوعة الكتاب المقدس</div><div>كنيسة رجاء الأمم سيدني</div>';
    document.body.appendChild(projectFooter);
}());
