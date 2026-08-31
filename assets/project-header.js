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
    brand.innerHTML = `
        <div class="project-brand-text">
            <div class="project-brand-name">موسوعة الكتاب المقدس</div>
            <div class="project-brand-church">كنيسة رجاء الأمم سيدني</div>
        </div>
        <img class="project-brand-logo" src="${logo ? logo.getAttribute('src') : 'assets/logo.png'}" alt="شعار كنيسة رجاء الأمم سيدني">
    `;

    const actions = document.createElement('div');
    actions.className = 'project-header-actions';

    const back = document.createElement('a');
    back.className = 'project-return';
    back.href = returnHref;
    back.innerHTML = `<span>↩</span><span>${returnText || 'الدراسات'}</span>`;
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
