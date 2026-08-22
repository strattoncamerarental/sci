/* =========================================================
   USED EQUIPMENT
   ========================================================= */

const modal = document.querySelector('#used-modal');
const modalImage = modal?.querySelector('.used-modal-image');
const modalClose = modal?.querySelector('.used-modal-close');
const modalPrev = modal?.querySelector('.used-modal-prev');
const modalNext = modal?.querySelector('.used-modal-next');
const modalCount = modal?.querySelector('.used-modal-count');

let currentImages = [];
let currentIndex = 0;


/* -- Galleries
------------------------------------------------------------- */

document.querySelectorAll('.used-gallery').forEach(gallery => {
	const mainButton = gallery.querySelector('.used-gallery-main');
	const mainImage = mainButton.querySelector('img');
	const thumbnails = [...gallery.querySelectorAll('.used-thumbnail')];

	thumbnails.forEach((thumbnail, index) => {
		thumbnail.addEventListener('click', () => {
			const thumbnailImage = thumbnail.querySelector('img');

			mainImage.src = thumbnailImage.src;
			currentIndex = index;

			thumbnails.forEach(item => {
				item.classList.remove('active');
			});

			thumbnail.classList.add('active');
		});
	});

	if (thumbnails.length) {
		thumbnails[0].classList.add('active');
	}

	mainButton.addEventListener('click', () => {
		currentImages = thumbnails.map(thumbnail =>
			thumbnail.querySelector('img').src
		);

		const activeThumbnail = gallery.querySelector('.used-thumbnail.active');
		currentIndex = thumbnails.indexOf(activeThumbnail);

		if (currentIndex < 0) {
			currentIndex = 0;
		}

		openModal();
	});
});

/* -- Individual product galleries
------------------------------------------------------------- */

document.querySelectorAll('.used-product-gallery').forEach(gallery => {
	const mainButtons = [...gallery.querySelectorAll('.used-gallery-main')];
	const thumbnails = [...gallery.querySelectorAll('.used-thumbnail')];

	const allImages = [
		...mainButtons.map(button => button.querySelector('img').src),
		...thumbnails.map(thumbnail => thumbnail.querySelector('img').src)
	];

	// Remove duplicate image URLs
	const images = [...new Set(allImages)];

	mainButtons.forEach(button => {
		button.addEventListener('click', () => {
			const src = button.querySelector('img').src;

			currentImages = images;
			currentIndex = images.indexOf(src);

			openModal();
		});
	});

	thumbnails.forEach(thumbnail => {
		thumbnail.addEventListener('click', () => {
			const src = thumbnail.querySelector('img').src;

			currentImages = images;
			currentIndex = images.indexOf(src);

			openModal();
		});
	});
});


/* -- Modal
------------------------------------------------------------- */

function openModal() {
	if (!modal || !currentImages.length) return;

	updateModal();

	modal.classList.add('is-open');
	modal.setAttribute('aria-hidden', 'false');
	document.body.style.overflow = 'hidden';
}


function closeModal() {
	if (!modal) return;

	modal.classList.remove('is-open');
	modal.setAttribute('aria-hidden', 'true');
	document.body.style.overflow = '';

	modalImage.src = '';
}


function updateModal() {
	modalImage.src = currentImages[currentIndex];

	modalCount.textContent =
		`${currentIndex + 1} / ${currentImages.length}`;
}


function previousImage() {
	currentIndex =
		(currentIndex - 1 + currentImages.length) % currentImages.length;

	updateModal();
}


function nextImage() {
	currentIndex =
		(currentIndex + 1) % currentImages.length;

	updateModal();
}


/* -- Modal controls
------------------------------------------------------------- */

modalClose?.addEventListener('click', closeModal);
modalPrev?.addEventListener('click', previousImage);
modalNext?.addEventListener('click', nextImage);

modal?.addEventListener('click', event => {
    if (
        event.target === modalPrev ||
        event.target === modalNext ||
        event.target === modalClose
    ) return;

    closeModal();
});


/* -- Keyboard controls
------------------------------------------------------------- */

document.addEventListener('keydown', event => {
	if (!modal?.classList.contains('is-open')) return;

	if (event.key === 'Escape') {
		event.preventDefault();
		closeModal();
	}

	if (event.key === 'ArrowLeft') {
		event.preventDefault();
		previousImage();
	}

	if (event.key === 'ArrowRight') {
		event.preventDefault();
		nextImage();
	}
});