document.addEventListener('DOMContentLoaded', () => {
  const formSettings = document.getElementById('form-settings');
  const btnCancel = document.getElementById('btn-cancel');
  const btnReset = document.getElementById('btn-reset');

  formSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    const formAccessToken = formSettings.elements.namedItem('access-token');
    localStorage.setItem('token', formAccessToken.value);

    self.close();
  });

  btnCancel.addEventListener('click', (e) => {
    e.preventDefault();
    self.close();
  });

  btnReset.addEventListener('click', (e) => {
    e.preventDefault();

    Settings.reset();
    showSettings();

    formSettings.value
  });
});
