document.addEventListener('DOMContentLoaded', function() {
  const labels = document.querySelectorAll('.product-label');

  labels.forEach(label => {
    const labelData = JSON.parse(label.dataset.label || '{}');
    if (labelData.color) {
      label.style.setProperty('--label-bg-color', labelData.color);
    }
    if (labelData.textColor) {
      label.style.setProperty('--label-text-color', labelData.textColor);
    }
  });
});
