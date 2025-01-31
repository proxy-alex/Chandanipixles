document.addEventListener('DOMContentLoaded', () => {
    // Image Modal Functionality
    const galleryItems = document.querySelectorAll('.gallery-item');
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('caption');
    const closeBtn = document.getElementsByClassName('close')[0];

    // Open modal when gallery item is clicked
    galleryItems.forEach(item => {
        const img = item.querySelector('img');
        item.addEventListener('click', () => {
            modal.style.display = "block";
            modalImg.src = img.src;
            captionText.innerHTML = img.alt;
        });
    });

    // Close the modal
    closeBtn.onclick = () => {
        modal.style.display = "none";
    }

    // Close modal when clicking outside the image
    modal.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }
});
