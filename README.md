# manim-renderer

## To run a prebuilt app
* Navigate to the [actions tab](https://github.com/ManimCommunity/manim-renderer/actions) and choose your desired commit
* Download the appropriate build for your operating system in the Artifacts section

**On MacOS** The zip file will contain a .dmg file. The first time you run the app you'll see a window saying that the developer cannot be verified. Apple's verification process requires paying $100 annually for a certificate, so we've opted not to do it. You can still run the renderer by following the instructions [here](https://support.apple.com/en-us/HT202491) in the section labeled "How to open an app that hasn’t been notarized or is from an unidentified developer".

**On Linux** The zip file will contain a .AppImage file. Before running the file you'll have to mark it as executable with `chmod +x manim-renderer-<version>.AppImage`.

**On Windows 10** The zip file will contain an application installer. When you run it you'll see a window saying that the app is unrecognized. Verifying software on Windows requires paying around $100 annually for a certificate, so we've opted not to do it. You can still run the renderer by clicking "More info" and "Run anyway" in the dialog. Automatic reloading doesn't work on Windows [due to the way its filesystem works](https://github.com/gorakhargosh/watchdog/issues/393).

## To develop
* Install dependencies: `yarn install`
* Compile and run with hot reloading: `yarn electron:serve`

## Using the renderer
Once the renderer is open, you can use it by passing the `--use_js_renderer` flag to manim, e.g. `manim example_scenes/basic.py SquareToCircle --use_js_renderer`. The scene should automatically be played in the JS renderer (you may have to restart the renderer with `ctrl+r`/`cmd+r`).
The scene will automatically be reloaded and replayed any time the file containing it is saved.

## To package
`yarn electron:build`

You can also lint and fix files with `yarn lint`.

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
