# MMM-SMP-Simple-Music-Player

This is a module for the [MagicMirror](https://github.com/MichMich/MagicMirror) project, which adds a simple music player. It can play server local files (files on the server, where the MagicMirror runs) at the client. It also provides access for playlists (current only m3u) and playing specific folders. The module can be controlled via Clicks or through other modules (through notifications for navigation).

The module uses a HTML5 Audio Element. A Music file will be be loaded completely by the server and sended to the client to be played. This means the performance depends on the network connection between the nodejs server and the client. Best performance will be reached, when the MagicMirror is displayed at the same server, where the nodejs server runs.

## Images
![Ground View](https://raw.githubusercontent.com/lucullusTheOnly/MMM-SMP-Simple-Music-Player/master/docs/ground.png)

![Source Menu](https://raw.githubusercontent.com/lucullusTheOnly/MMM-SMP-Simple-Music-Player/master/docs/source_menu.png)

![Playing](https://raw.githubusercontent.com/lucullusTheOnly/MMM-SMP-Simple-Music-Player/master/docs/Playing.png)

![Volume, Looping and Shuffle](https://raw.githubusercontent.com/lucullusTheOnly/MMM-SMP-Simple-Music-Player/master/docs/volume_shuffle_loop.png)

## Installation
Run these command at the root of your magic mirror install.

```shell
cd modules
git clone https://github.com/lucullusTheOnly/MMM-SMP-Simple-Music-Player.git
cd MMM-SMP-Simple-Music-Player
npm install
```

## Using the module
To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
  modules: [
    {
      module: 'MMM-SMP-Simple-Music-Player',
      position: 'bottom_right', // choose your desired position from the options provided by MagicMirror^2
      config: {
        // See below for configurable options
      }
    }
  ]
}
```

## Configuration options
The following properties can be set for this module:

<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>enablePlaylistMenu</code></td>
			<td>Configures, if the Playlist category should be displayed in the source menu.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
                <br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
		<tr>
			<td><code>enableFolderMenu</code></td>
			<td>Configures, if the Folder category should be displayed in the source menu.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
                <br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
		<tr>
			<td><code>folders</code></td>
			<td>A list of folder paths (strings), that should be displayed (and thus be playable) in the source menu.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>String array</code>
                <br><b>Default value:</b> <code>[]</code>
			</td>
		</tr>
    <tr>
			<td><code>folderRecursive</code></td>
			<td>If <code>true</code>, the music files from a selected folder will be searched recursively (this means including any sub- or subsubfolders).
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
                <br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
    <tr>
			<td><code>maxMenuEntries</code></td>
			<td>The number of menu entries, that should be displayed at once in the source menu. If this number is smaller than the actual number of entries, navigation arrows will be displayed. A value of zero will result in no limitation.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> Any valid <code>int</code> between 0 and 100
                <br><b>Default value:</b> <code>100</code>
			</td>
		</tr>
    <tr>
			<td><code>volume</code></td>
			<td>Set's the initial volume in percent.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> Any valid <code>int</code>
                <br><b>Default value:</b> <code>10</code>
			</td>
		</tr>
    <tr>
			<td><code>loop</code></td>
			<td>Initial value for looping.
        <ul><li><code>'noloop'</code> - The playlist will not be looped
                </li><li><code>'loop'</code> - The complete playlist will be looped (played again after the playlist ended).
                </li><li><code>'loop1'</code> - Loops only the current song.</li></ul>
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>'noloop'</code> or <code>'loop'</code> or <code>'loop1'</code>
                <br><b>Default value:</b> <code>'noloop'</code>
			</td>
		</tr>
    <tr>
			<td><code>shuffle</code></td>
			<td>If <code>true</code>, the playback of the playlist will be shuffled (initial value).
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
                <br><b>Default value:</b> <code>false</code>
			</td>
		</tr>
    <tr>
			<td><code>autoplay</code></td>
			<td>If <code>true</code>, the music will start directly, when a playlist/folder is selected.
				<br> <br> This value is <b>OPTIONAL</b>
				<br><b>Possible values:</b> <code>true</code> or <code>false</code>
                <br><b>Default value:</b> <code>true</code>
			</td>
		</tr>
	</tbody>
</table>
