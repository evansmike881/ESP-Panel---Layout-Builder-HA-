# ESP Panel Layout Builder

Home Assistant add-on repository for visually editing ESPHome/LVGL widget helpers for a 480x480 ESP panel.

## File tree

```text
esp-panel-layout-builder/
  repository.yaml
  README.md
  esp-panel-layout-builder/
    config.yaml
    Dockerfile
    run.sh
    app/
      package.json
      tsconfig.json
      vite.config.js
      index.html
      server.js
      src/
        main.tsx
        App.tsx
        api.ts
        types.ts
        styles.css
```

## Add repository to Home Assistant

1. Open **Settings > Add-ons > Add-on Store**.
2. Open the overflow menu and choose **Repositories**.
3. Add the Git repository URL that contains this folder.
4. Refresh the add-on store.

## Install the add-on

1. Open **ESP Panel Layout Builder** from the add-on store.
2. Click **Install**.
3. Optionally enable **Show in sidebar**.
4. Start the add-on.

## Open the GUI

1. Open the add-on details page.
2. Click **Open Web UI**.
3. If ingress is enabled, the UI opens inside Home Assistant.

## Create/apply helpers

1. Open the **Helper YAML** button in the app.
2. Copy the generated package YAML.
3. Save it in your Home Assistant config, for example `packages/esp_panel_layout_builder.yaml`.
4. Make sure packages are enabled in `configuration.yaml`.
5. Reload helpers or restart Home Assistant.
6. Return to the add-on and click **Reload from Home Assistant**.

## Test a layout change

1. Drag `w06` to a new grid position in the preview.
2. Resize it using the corner handle.
3. Change its label to `Office Light`.
4. Click **Apply all changes**.
5. Confirm these helpers update in Home Assistant:
   - `input_text.esp_panel_w06_label`
   - `input_number.esp_panel_w06_x`
   - `input_number.esp_panel_w06_y`
   - `input_number.esp_panel_w06_w`
   - `input_number.esp_panel_w06_h`

## Extend from 6 widgets to 12 later

1. Update the widget ID list in `app/server.js` and `app/src/types.ts`.
2. Expand the default layout array in `app/server.js` and `app/src/types.ts`.
3. The helper YAML generator automatically follows the widget ID list, so add `w07` to `w12`.
4. If the screen layout stays 6x6, no grid logic changes are required.
5. If you want paging or more on-screen widgets, extend the helper schema and preview rendering rules in the React app.

## Notes

- The add-on uses `SUPERVISOR_TOKEN` or `HASSIO_TOKEN`.
- Internal Home Assistant API calls go to `http://supervisor/core/api`.
- This workspace did not have `node` or `npm` installed, so the files were not build-tested locally here.
