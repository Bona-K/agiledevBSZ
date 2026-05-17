/* global $ */

// Page: profile_edit.html
// Live preview of avatar + bio character count.
(function profileEditPage() {
  if ($("body").attr("data-page") !== "profile-edit") return;

  $(document).ready(function () {
    // Bio character counter
    const $bio   = $("#bio");
    const $count = $("#bioCount");
    function updateCount() {
      $count.text(String($bio.val() || "").length);
    }
    $bio.on("input", updateCount);
    updateCount();

    // Live avatar preview
    const $input   = $("#avatarInput");
    const $preview = $("#avatarPreview");
    $input.on("change", function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        $preview.html(
          '<img src="' + e.target.result + '" alt="" class="h-full w-full object-cover" />'
        );
      };
      reader.readAsDataURL(file);
    });
  });
})();
