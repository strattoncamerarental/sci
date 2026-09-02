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
	resetImageZoom();

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


/* -- Image zoom / pan / swipe
------------------------------------------------------------- */

let imageScale = 1;
let imageX = 0;
let imageY = 0;

let startDistance = 0;
let startScale = 1;

let startX = 0;
let startY = 0;
let startImageX = 0;
let startImageY = 0;

let isPanning = false;
let isPinching = false;

let swipeStartX = 0;
let swipeStartY = 0;


function applyImageTransform() {
	modalImage.style.transform =
		`translate(${imageX}px, ${imageY}px) scale(${imageScale})`;
}


function resetImageZoom() {
	imageScale = 1;
	imageX = 0;
	imageY = 0;
	isPanning = false;
	isPinching = false;

	applyImageTransform();
}


function touchDistance(touch1, touch2) {
	const x = touch2.clientX - touch1.clientX;
	const y = touch2.clientY - touch1.clientY;

	return Math.hypot(x, y);
}


modalImage?.addEventListener('touchstart', event => {
	if (event.touches.length === 2) {
		isPinching = true;
		isPanning = false;

		startDistance = touchDistance(
			event.touches[0],
			event.touches[1]
		);

		startScale = imageScale;
	}

	else if (event.touches.length === 1) {
		startX = event.touches[0].clientX;
		startY = event.touches[0].clientY;

		swipeStartX = startX;
		swipeStartY = startY;

		if (imageScale > 1) {
			isPanning = true;

			startImageX = imageX;
			startImageY = imageY;
		}
	}
}, { passive: false });


modalImage?.addEventListener('touchmove', event => {
	if (isPinching && event.touches.length === 2) {
		event.preventDefault();

		const distance = touchDistance(
			event.touches[0],
			event.touches[1]
		);

		imageScale = Math.min(
			4,
			Math.max(1, startScale * distance / startDistance)
		);

		if (imageScale === 1) {
			imageX = 0;
			imageY = 0;
		}

		applyImageTransform();
	}

	else if (isPanning && event.touches.length === 1) {
		event.preventDefault();

		imageX =
			startImageX +
			event.touches[0].clientX -
			startX;

		imageY =
			startImageY +
			event.touches[0].clientY -
			startY;

		applyImageTransform();
	}
}, { passive: false });


modalImage?.addEventListener('touchend', event => {
	if (event.touches.length < 2) {
		isPinching = false;
	}

	if (event.touches.length === 0) {
		const touch = event.changedTouches[0];

		if (!isPanning && imageScale === 1 && touch) {
			const deltaX = touch.clientX - swipeStartX;
			const deltaY = touch.clientY - swipeStartY;

			if (
				Math.abs(deltaX) > 50 &&
				Math.abs(deltaX) > Math.abs(deltaY)
			) {
				if (deltaX < 0) {
					nextImage();
				}
				else {
					previousImage();
				}
			}
		}

		isPanning = false;

		if (imageScale <= 1) {
			resetImageZoom();
		}
	}
});


/* -- Modal controls
------------------------------------------------------------- */

modalClose?.addEventListener('click', closeModal);
modalPrev?.addEventListener('click', previousImage);
modalNext?.addEventListener('click', nextImage);

modal?.addEventListener('click', event => {
	if (
		event.target === modalImage ||
		event.target === modalPrev ||
		event.target === modalNext ||
		event.target === modalClose ||
		modalClose?.contains(event.target)
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