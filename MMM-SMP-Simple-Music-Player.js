Module.register("MMM-SMP-Simple-Music-Player",{
  defaults: {
    enablePlaylistMenu: true,
    enableFolderMenu: false,
    folders: [],
    folderRecursive: false,
    maxMenuEntries: 10,
    volume: 100,
    loop: "noloop",
    shuffle: false,
    autoplay: true
  },

  getStyles: function() {
    return ["style.css"];
  },
  
  start: function() {
    Log.info("Starting module: "+ this.name);
    this.playlists = [];
    this.folder_structure = [];
    this.playlist = [];
    this.current_song = 0;
    this.source_menu_selected = 0;
    this.source_menu_viewport_pos = 0;
    this.source_menu_length = 0;
    this.playerstate = "stopped";
    this.initializedDom = false;
    this.navistate = "ground";
    this.current_button = 0;
    this.clicking_active = false;
    this.change_viewport_interval = null;
    this.sendSocketNotification("INITIALIZE", {folders: this.config.folders, enableFolderMenu: this.config.enableFolderMenu});
  },


  getDom: function() {
    var self = this;
    function initializeDom() {
      var wrapper = document.createElement("div");
      wrapper.id = self.identifier + "_wrapper";
      var table = document.createElement("table");
      table.className = "layouttable";
      var table_row_buttons = document.createElement("tr");
      var table_row_timeSlider = document.createElement("tr");
      var table_row_source = document.createElement("tr");
      var table_row_source_menu = document.createElement("tr");
      var table_row_currentsong = document.createElement("tr");
      var table_col_buttons = document.createElement("td");
      table_col_buttons.setAttribute("colspan", "2");
      var table_col_volumeSlider = document.createElement("td");

      var table_col_timeSlider = document.createElement("td");
      table_col_timeSlider.setAttribute("colspan", "2");
      table_col_timeSlider.className = "table_col_timeslider";
      var table_col_source = document.createElement("td");
      var table_col_currentsong = document.createElement("td");
      table_col_currentsong.setAttribute("colspan", "2");
      var table_col_source_image = document.createElement("td");
      var table_col_source_menu = document.createElement("td");
      table_col_source_menu.className = "layouttable";
      table_col_source_menu.setAttribute("colspan", "2");
      table_row_timeSlider.appendChild(table_col_timeSlider);
      table_row_buttons.appendChild(table_col_buttons);
      table_row_buttons.appendChild(table_col_volumeSlider);
      table_row_source.appendChild(table_col_source_image);
      table_row_source_menu.appendChild(table_col_source_menu);
      table_row_source.appendChild(table_col_source);
      table_row_currentsong.appendChild(table_col_currentsong);
      table.appendChild(table_row_source_menu);
      table.appendChild(table_row_source);
      table.appendChild(table_row_buttons);
      table.appendChild(table_row_timeSlider);
      table.appendChild(table_row_currentsong);

      var timeSlider = document.createElement("div");
      timeSlider.className = "duration_progressbar";
      timeSlider.id = "duration_progressbar"+self.identifier;
      var innerSlider = document.createElement("div");
      innerSlider.id = "duration_inner_progressbar"+self.identifier;
      function timeslider_click_cb(e){
        var newpos = Math.floor(e.offsetX/document.getElementById("duration_progressbar"+self.identifier).offsetWidth*100);
        self.navistate = "ground";
        self.clicking_active = true;
        self.setButtonMarker();
        self.hideMenu();
        self.sendSocketNotification("TIMECHANGE",{newposition: newpos});
      }
      timeSlider.onclick = timeslider_click_cb;
      timeSlider.appendChild(innerSlider);

      var volumeSlider = document.createElement("div");
      volumeSlider.className = "volume_progressbar";
      volumeSlider.id = "volume_progressbar"+self.identifier;
      var innervolumeSlider = document.createElement("div");
      innervolumeSlider.id = "inner_volume_slider"+self.identifier;
      innervolumeSlider.style.width = self.config.volume+"%";
      function volumeslider_click_cb(e){
        self.config.volume = Math.floor(e.offsetX/(document.getElementById("volume_progressbar"+self.identifier).offsetWidth-6)*100);
        document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume"
                                                        + Math.floor(self.config.volume / 25)
                                                        + ".svg";
        if(self.config.volume == 0){
          document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume_off.svg";
        }
        document.getElementById("inner_volume_slider"+self.identifier).style.width = self.config.volume + "%";
        self.sendSocketNotification("VOLUMECHANGE", self.config.volume);
      }
      volumeSlider.onclick = volumeslider_click_cb;
      volumeSlider.appendChild(innervolumeSlider);
      innervolumeSlider.style.backgroundColor = "#000000";
      volumeSlider.style.border = "2px solid #000";

      var source_button = document.createElement("IMG");
      source_button.className = "source";
      source_button.id = "source_button"+self.identifier;
      source_button.src = "MMM-SMP-Simple-Music-Player/source.svg";
      function button_action_source_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_source("click");
      }
      source_button.onclick = button_action_source_cb;
      var source_text = document.createElement("div");
      source_text.className = "sourcetext";
      source_text.id = "sourcetext"+self.identifier;
      source_text.innerHTML = "Choose music source...";

      self.source_menu = document.createElement("ul");
      self.source_menu.id = "sourcemenu"+self.identifier;
      self.source_menu.className = "sourcemenu";
      self.source_menu.style.visibility = "hidden";

      self.currentsong_text = document.createElement("div");
      self.currentsong_text.innerHTML = "Songtitle - Interpret";
      self.currentsong_text.className = "currentsong";
      self.currentsong_text.id = "currentsong_text"+self.identifier;

      var interaction_wrapper = document.createElement("div");
      interaction_wrapper.setAttribute("display", "flex");
      interaction_wrapper.setAttribute("white-space", "nowrap");
      
      var play_pause_button = document.createElement("IMG");
      play_pause_button.className = "play";
      play_pause_button.id = "play_button"+self.identifier;
      play_pause_button.src = "MMM-SMP-Simple-Music-Player/play.svg";
      function button_action_play_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_play();
      }
      play_pause_button.onclick = button_action_play_cb;
      var back_button = document.createElement("IMG");
      back_button.className = "back";
      back_button.id = "back_button"+self.identifier;
      back_button.src = "MMM-SMP-Simple-Music-Player/rev.svg";
      function button_action_back_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_back();
      }
      back_button.onclick = button_action_back_cb;
      var next_button = document.createElement("IMG");
      next_button.className = "next";
      next_button.id = "next_button"+self.identifier;
      next_button.src = "MMM-SMP-Simple-Music-Player/next.svg";
      function button_action_next_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_next();
      }
      next_button.onclick = button_action_next_cb;
      var stop_button = document.createElement("IMG");
      stop_button.className = "stop";
      stop_button.id = "stop_button"+self.identifier;
      stop_button.src = "MMM-SMP-Simple-Music-Player/stop.svg";
      function button_action_stop_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_stop();
      }
      stop_button.onclick = button_action_stop_cb;
      var loop_button = document.createElement("IMG");
      loop_button.className = "loop";
      loop_button.id = "loop_button"+self.identifier;
      switch(self.config.loop){
        case "noloop":
          loop_button.src = "MMM-SMP-Simple-Music-Player/noloop.svg";
          break;
        case "loop":
          loop_button.src = "MMM-SMP-Simple-Music-Player/loop.svg";
          break;
        case "loop1":
          loop_button.src = "MMM-SMP-Simple-Music-Player/loop1.svg";
          break;
      }
      function button_action_loop_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_loop();
      }
      loop_button.onclick = button_action_loop_cb;
      var shuffle_button = document.createElement("IMG");
      shuffle_button.className = "shuffle";
      shuffle_button.id = "shuffle_button"+self.identifier;
      if(self.config.shuffle)
        shuffle_button.src = "MMM-SMP-Simple-Music-Player/shuffle.svg";
      else
        shuffle_button.src = "MMM-SMP-Simple-Music-Player/noshuffle.svg";
      function button_action_shuffle_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_shuffle();
      }
      shuffle_button.onclick = button_action_shuffle_cb;
      var volume_button = document.createElement("IMG");
      volume_button.className = "volume";
      volume_button.id = "volume_button"+self.identifier;
      volume_button.src = "MMM-SMP-Simple-Music-Player/volume3.svg";
      function button_action_volume_cb(){
        self.clicking_active = true;
        self.setButtonMarker();
        self.button_action_volume("click");
      }
      volume_button.onclick = button_action_volume_cb;

      self.button_mapping = [ source_button, play_pause_button, back_button, next_button, stop_button, loop_button, shuffle_button, volume_button, table_col_timeSlider ];

      interaction_wrapper.appendChild(play_pause_button);
      interaction_wrapper.appendChild(back_button);
      interaction_wrapper.appendChild(next_button);
      interaction_wrapper.appendChild(stop_button);
      interaction_wrapper.appendChild(loop_button);
      interaction_wrapper.appendChild(shuffle_button);
      interaction_wrapper.appendChild(volume_button);
      interaction_wrapper.appendChild(volumeSlider);

      table_col_buttons.appendChild(interaction_wrapper);
      table_col_timeSlider.appendChild(timeSlider);
      table_col_source_image.appendChild(source_button);
      table_col_source.appendChild(source_text);
      table_col_source_menu.appendChild(self.source_menu);
      table_col_currentsong.appendChild(self.currentsong_text);
      
      table_col_buttons.className = "layouttable";
      //table_col_timeSlider.className = "layouttable";
      table_col_source_image.className = "layouttable";
      table_col_source.className = "layouttable";
      table_col_currentsong.className = "layouttable";
      wrapper.appendChild(table);
      
      self.initializedDom = true;
      self.wrapper = wrapper;
    }

    if(!this.initializedDom) {
      initializeDom();
    }
    
    self.setButtonMarker();
    return this.wrapper;
  },

  setButtonMarker: function(){
    var i;
    for(i=0;i<this.button_mapping.length;i++){
      this.button_mapping[ i ].style.border = "thin solid #000000";
    }
    if(!this.clicking_active) this.button_mapping[ this.current_button ].style.border = "thin solid #FFFFFF";
  },

  hideMenu: function(){
    var self=this;
    if(this.clicking_active){
      if(this.navistate == "ground"){ // Hide all menus
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#000000";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #000";
        document.getElementById("duration_progressbar"+self.identifier).style.border = "2px solid #fff";
        document.getElementById("duration_progressbar"+self.identifier).style.margin = "5px";
        document.getElementById("sourcemenu"+self.identifier).style.visibility = "hidden";
      } else if(this.navistate == "volume"){ // Hide source menu
        document.getElementById("sourcemenu"+self.identifier).style.visibility = "hidden";
        document.getElementById("duration_progressbar"+self.identifier).style.border = "2px solid #fff";
        document.getElementById("duration_progressbar"+self.identifier).style.margin = "5px";
      } else if(this.navistate == "source"){ // Hide volume menu
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#000000";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #000";
        document.getElementById("duration_progressbar"+self.identifier).style.border = "2px solid #fff";
        document.getElementById("duration_progressbar"+self.identifier).style.margin = "5px";
      }
    }
  },

  selectSourceEntry: function(){
    this.resetSourceMenuSelected();
    this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).className = "sourcemenuEntry_selected";
  },

  getMenuEntryByIndex: function(index, element) {
    var self=this;
    for(var i=0;i< element.children.length;i++){
      if(element.children[i].children.length > 0 && element.children[i].children[0].tagName == "UL"){
        var found_index = self.getMenuEntryByIndex(index, element.children[i].children[0]);
        if(found_index !== null) return found_index;
      } else if(element.children[i].menu_index == index){
        return element.children[i];
      }
    }
    return null;
  },

  fillPlaylistMenu: function(parent_menu, playlist_list, menu_index) {
    var self=this;
    var playlist_menu = document.createElement("ul");
    playlist_menu.className = "sourcemenuEntry";
    parent_menu.appendChild(playlist_menu);

    for(var i=0; i<playlist_list.length;i++){
      var entry = document.createElement("li");
      entry.innerHTML = playlist_list[i];
      entry.menu_index = menu_index;
      entry.actiontype = "playlist";
      function entry_hover_cb(){
        self.source_menu_selected = this.menu_index;
        self.selectSourceEntry();
      }
      function entry_hoverout_cb(){
        self.resetSourceMenuSelected();
      }
      function entry_click_cb(){
        self.button_action_sourceentry();
      }
      entry.onmouseover = entry_hover_cb;
      entry.onmouseout = entry_hoverout_cb;
      entry.onclick = entry_click_cb;
      menu_index++;
      playlist_menu.appendChild(entry);
    }

    return menu_index;
  },

  fillFolderMenu: function(parent_menu, folder_list, menu_index) {
    var self=this;
    var folder_menu = document.createElement("ul");
    folder_menu.className = "sourcemenuEntry";
    parent_menu.appendChild(folder_menu);

    for(var i=0; i<folder_list.length;i++){
      var entry = document.createElement("li");
      entry.innerHTML = folder_list[i].name;
      entry.path = folder_list[i].path;
      entry.menu_index = menu_index;
      entry.actiontype = "folder";
      function entry_hover_cb(){
        self.source_menu_selected = this.menu_index;
        self.selectSourceEntry();
      }
      function entry_hoverout_cb(){
        self.resetSourceMenuSelected();
      }
      function entry_click_cb(){
        self.button_action_sourceentry();
      }
      entry.onmouseover = entry_hover_cb;
      entry.onmouseout = entry_hoverout_cb;
      entry.onclick = entry_click_cb;
      menu_index++;
      folder_menu.appendChild(entry);

      if(folder_list[i].content.length > 0){
        var entry_content_menu = document.createElement("li");
        entry_content_menu.className = "sourcemenuEntry";
        //this.entry_content_menu.id="sourcemenu_folder_"+menu_index+"_"+self.identifier;
        folder_menu.appendChild(entry_content_menu);
        menu_index = self.fillFolderMenu(entry_content_menu, folder_list[i].content, menu_index);
      }
    }

    return menu_index;
  },

  buildSourceMenu: function(parent_list) {
    var self=this;
    var menu_index = 0;

    //Creating Back Entry
    var back_entry = document.createElement("li");
    back_entry.className = "sourcemenuEntry";
    back_entry.innerHTML = "<--";
    back_entry.menu_index = menu_index;
    function back_entry_hover_cb(){
      self.source_menu_selected = back_entry.menu_index;
      self.selectSourceEntry();
    }
    function back_entry_hoverout_cb(){
      self.resetSourceMenuSelected();
    }
    function back_entry_click_cb(){
      self.button_action_sourceentry();
    }
    back_entry.onmouseover = back_entry_hover_cb;
    back_entry.onmouseout = back_entry_hoverout_cb;
    back_entry.onclick = back_entry_click_cb;
    menu_index++;
    parent_list.appendChild(back_entry);

    if(this.config.enablePlaylistMenu){
      var playlist_menu = document.createElement("li");
      playlist_menu.className = "sourcemenuEntry";
      playlist_menu.innerHTML = "Playlists:";
      playlist_menu.menu_index = menu_index;
      function playlist_entry_hover_cb(){
        self.source_menu_selected = playlist_menu.menu_index;
        self.selectSourceEntry();
      }
      function playlist_entry_hoverout_cb(){
        self.resetSourceMenuSelected();
      }
      playlist_menu.onmouseover = playlist_entry_hover_cb;
      playlist_menu.onmouseout = playlist_entry_hoverout_cb;
      menu_index++;

      this.playlist_list_menu = document.createElement("li");
      this.playlist_list_menu.className = "sourcemenuEntry";
      this.playlist_list_menu.id="sourcemenu_playlists_"+self.identifier;
      parent_list.appendChild(playlist_menu);
      parent_list.appendChild(this.playlist_list_menu);
      menu_index = this.fillPlaylistMenu(this.playlist_list_menu, this.playlists, menu_index);
    }

    if(this.config.enableFolderMenu){
      var folder_menu = document.createElement("li");
      folder_menu.className = "sourcemenuEntry";
      folder_menu.innerHTML = "Folder:";
      folder_menu.menu_index = menu_index;
      function folder_entry_hover_cb(){
        self.source_menu_selected = folder_menu.menu_index;
        self.selectSourceEntry();
      }
      function folder_entry_hoverout_cb(){
        self.resetSourceMenuSelected();
      }
      folder_menu.onmouseover = folder_entry_hover_cb;
      folder_menu.onmouseout = folder_entry_hoverout_cb;
      menu_index++;

      this.folder_list_menu = document.createElement("li");
      this.folder_list_menu.className = "sourcemenuEntry";
      this.folder_list_menu.id="sourcemenu_playlists_"+self.identifier;
      parent_list.appendChild(folder_menu);
      parent_list.appendChild(this.folder_list_menu);
      menu_index = this.fillFolderMenu(this.folder_list_menu, this.folder_structure, menu_index);
    }

    self.source_menu_length = menu_index;
    if(self.config.maxMenuEntries < self.source_menu_length){ // Some entries have to be hidden
      Log.log("Creating menu navigation arrows");
      var up_arrow = document.createElement("li");
      up_arrow.className = "sourcemenuEntry";
      up_arrow.id = "sourcemenu_up_"+self.identifier;
      var up_arrow_image = document.createElement("IMG");
      up_arrow_image.className = "up_arrow_image";
      up_arrow_image.id = "up_arrow_image_"+self.identifier;
      up_arrow_image.src = "MMM-SMP-Simple-Music-Player/up_inactive.svg";
      function up_arrow_hover_cb(){
        self.source_menu_viewport_up(true);
      }
      function up_arrow_hoverout_cb(){
        self.source_menu_viewport_up(false);
      }
      up_arrow.onmouseover = up_arrow_hover_cb;
      up_arrow.onmouseout = up_arrow_hoverout_cb;
      up_arrow.appendChild(up_arrow_image);
      parent_list.insertBefore(up_arrow, parent_list.firstChild);

      var down_arrow = document.createElement("li");
      down_arrow.className = "sourcemenuEntry";
      down_arrow.id = "sourcemenu_down_"+self.identifier;
      var down_arrow_image = document.createElement("IMG");
      down_arrow_image.className = "down_arrow_image";
      down_arrow_image.id = "down_arrow_image_"+self.identifier;
      down_arrow_image.src = "MMM-SMP-Simple-Music-Player/down.svg";
      function down_arrow_hover_cb(){
        self.source_menu_viewport_down(true);
      }
      function down_arrow_hoverout_cb(){
        self.source_menu_viewport_down(false);
      }
      down_arrow.onmouseover = down_arrow_hover_cb;
      down_arrow.onmouseout = down_arrow_hoverout_cb;
      down_arrow.appendChild(down_arrow_image);
      parent_list.appendChild(down_arrow);
    }
    for(var i=self.config.maxMenuEntries;i<menu_index;i++){
      self.getMenuEntryByIndex(i, parent_list).style.display = "none";
    }

    this.getMenuEntryByIndex(0, parent_list).className = "sourcemenuEntry_selected";
    this.sourceMenuLength = menu_index;
  },

  resetSourceMenuSelected: function(menu = this.source_menu){
    for(var i=0;i<menu.children.length;i++){
      if(menu.children[i].children.length > 0 && menu.children[i].children[0].tagName == "UL"){
        this.resetSourceMenuSelected(menu.children[i].children[0]);
      } else {
        menu.children[i].className = "sourcemenuEntry";
      }
    }
  },

  source_menu_viewport_down: function(active){
    var self=this;
    if(self.source_menu_viewport_pos == self.source_menu_length - self.config.maxMenuEntries) return;
    if(active){
      if(self.change_viewport_interval == null){
        self.change_viewport_interval = setInterval(function(){
          self.source_menu_viewport_pos++;
          if(self.source_menu_viewport_pos > self.source_menu_length - self.config.maxMenuEntries - 1) self.source_menu_viewport_pos = self.source_menu_length - self.config.maxMenuEntries - 1;
          self.update_source_menu_viewport();
        }, 200);
      }
    } else {
      clearInterval(self.change_viewport_interval);
      self.change_viewport_interval = null;
    }
  },

  source_menu_viewport_up: function(active){
    var self=this;
    if(self.source_menu_viewport_pos == 0) return;
    if(active){
      if(self.change_viewport_interval == null){
        self.change_viewport_interval = setInterval(function(){
          self.source_menu_viewport_pos--;
          if(self.source_menu_viewport_pos < 0) self.source_menu_viewport_pos = 0;
          self.update_source_menu_viewport();
        }, 200);
      }
    } else {
      clearInterval(self.change_viewport_interval);
      self.change_viewport_interval = null;
    }
  },

  update_source_menu_viewport: function(){
    var self=this;
    for(var i=0;i<self.source_menu_length;i++){
      if(i < self.source_menu_viewport_pos || i > self.source_menu_viewport_pos + self.config.maxMenuEntries) {
        self.getMenuEntryByIndex(i, self.source_menu).style.display = "none";
      } else {
        self.getMenuEntryByIndex(i, self.source_menu).style.display = "block";
      }
    }

    if(self.source_menu_viewport_pos == 0){
      document.getElementById("up_arrow_image_"+self.identifier).src = "MMM-SMP-Simple-Music-Player/up_inactive.svg";
    } else {
      document.getElementById("up_arrow_image_"+self.identifier).src = "MMM-SMP-Simple-Music-Player/up.svg";
    }

    if(self.source_menu_viewport_pos == self.source_menu_length - self.config.maxMenuEntries - 1) {
      document.getElementById("down_arrow_image_"+self.identifier).src = "MMM-SMP-Simple-Music-Player/down_inactive.svg";
    } else {
      document.getElementById("down_arrow_image_"+self.identifier).src = "MMM-SMP-Simple-Music-Player/down.svg";
    }
  },

  button_action_play: function(){
    var self=this;
    if(this.playlist.length == 0) {Log.log("*********Playlist empty");return;}
    if(this.playerstate == "stopped"){
      this.playerstate = "playing";
      document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/pause.svg";
      this.sendSocketNotification("LOADFILE", this.current_song);
    } else if(this.playerstate == "playing"){
      this.playerstate = "paused";
      document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/play.svg";
      this.sendSocketNotification("PAUSEFILE",'');
    } else if(this.playerstate == "paused"){
      this.playerstate = "playing";
      document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/pause.svg";
      this.sendSocketNotification("RESUMEFILE");
    }
    this.navistate = "ground";
    this.hideMenu();
  },

  button_action_back: function(){
    if(this.current_song <= 0 && (this.config.loop!="loop" && !this.config.shuffle)) return;
    this.sendSocketNotification("PREVIOUSFILE",'');
    this.navistate = "ground";
    this.hideMenu();
  },

  button_action_next: function(){
    if(this.current_song >= this.playlist.length - 1 && (this.config.loop!="loop" && !this.config.shuffle)) return;
    this.sendSocketNotification("NEXTFILE", '');
    this.navistate = "ground";
    this.hideMenu();
  },

  button_action_stop: function(){
    var self=this;
    document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/play.svg";
    document.getElementById("duration_inner_progressbar"+self.identifier).style.width = "0%";
    this.playerstate = "stopped";
    this.sendSocketNotification("STOPFILE",'');
    this.navistate = "ground";
    this.hideMenu();
  },

  button_action_loop: function(){
    var self=this;
    switch(self.config.loop){
      case "noloop":
        self.config.loop = "loop";
        document.getElementById("loop_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/loop.svg";
        break;
      case "loop":
        self.config.loop = "loop1";
        document.getElementById("loop_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/loop1.svg";
        break;
      case "loop1":
        self.config.loop = "noloop";
        document.getElementById("loop_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/noloop.svg";
        break;
    }
    self.sendSocketNotification("PLAYERSETTINGS", {loop: self.config.loop, shuffle: self.config.shuffle});
    this.navistate = "ground";
    self.hideMenu();
  },

  button_action_shuffle: function(){
    var self=this;
    if(self.config.shuffle){
      self.config.shuffle = false;
      document.getElementById("shuffle_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/noshuffle.svg";
    } else {
      self.config.shuffle = true;
      document.getElementById("shuffle_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/shuffle.svg";
    }
    self.sendSocketNotification("PLAYERSETTINGS", {loop: self.config.loop, shuffle: self.config.shuffle});
    this.navistate = "ground";
    self.hideMenu();
  },

  button_action_volume: function(eventtype){
    var self=this;
    if(eventtype=="click"){
      if(document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor == "rgb(255, 255, 255)"){
        this.navistate = "ground";
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#000000";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #000";
      } else {
        this.navistate = "volume";
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#FFFFFF";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #FFF";
      }
    } else {
      if(this.navistate == "ground"){
        this.navistate = "volume";
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#FFFFFF";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #fff";
      } else if(this.navistate == "volume"){
        this.navistate = "ground";
        document.getElementById("inner_volume_slider"+self.identifier).style.backgroundColor = "#000000";
        document.getElementById("volume_progressbar"+self.identifier).style.border = "2px solid #000";
      }
    }
    this.hideMenu();
  },

  button_action_source: function(eventtype){
    var self=this;
    if(eventtype == "click"){
      if(document.getElementById("sourcemenu"+self.identifier).style.visibility == "hidden"){
        document.getElementById("sourcemenu"+self.identifier).style.visibility = "visible";
        this.navistate = "source";
      } else {
        document.getElementById("sourcemenu"+self.identifier).style.visibility = "hidden";
        this.navistate = "ground";
      }
    } else {
      if(this.navistate == "ground"){
        document.getElementById("sourcemenu"+self.identifier).style.visibility = "visible";
        this.navistate = "source";
      } else if(this.navistate == "source"){
        this.button_action_sourceentry();
      }
    }
    this.hideMenu();
  },

  button_action_sourceentry: function(){
    var self=this;
    if(this.source_menu_selected == 0) {
      document.getElementById("sourcemenu"+self.identifier).style.visibility = "hidden";
      this.navistate = "ground";
    } else {
      switch(this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).actiontype){
        case "playlist":
          this.sendSocketNotification("LOADPLAYLIST", {name: this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).innerHTML, autoplay: this.config.autoplay});
          break;
        case "folder":
          var entry = this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu);
          this.sendSocketNotification("LOADFOLDER", {name: entry.innerHTML, path: entry.path, recursive: this.config.folderRecursive, autoplay: this.config.autoplay});
          break;
      }
    }
  },

  naviAction: function(action) {
    var self=this;
    switch(action){
      case "NAVIGATE_BACK":
        switch(this.navistate){
          case "ground":
            this.current_button--;
            if( this.current_button < 0 ) this.current_button = 0;
            this.updateDom(0);
            break;
          case "volume":
            this.config.volume -= 10;
            if(this.config.volume < 0) this.config.volume = 0;
            document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume"
                                                            + Math.floor(this.config.volume / 25)
                                                            + ".svg";
            if(this.config.volume == 0){
              document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume_off.svg";
            }
            document.getElementById("inner_volume_slider"+self.identifier).style.width = this.config.volume + "%";
            this.sendSocketNotification("VOLUMECHANGE", this.config.volume);
            break;
          case "source":
            this.source_menu_selected--;
            if(this.source_menu_selected < 0) this.source_menu_selected=0;
            if(this.source_menu_selected < this.source_menu_viewport_pos){
              this.source_menu_viewport_pos--;
              if(this.source_menu_viewport_pos < 0) this.source_menu_viewport_pos = 0;
              this.update_source_menu_viewport();
            }
            //Log.log("MenuIndex: Searching for " + this.source_menu_selected);
            this.selectSourceEntry();
            break;
          case "duration":
            if(this.playerstate == "playing")
              this.sendSocketNotification("TIMECHANGE",{direction: 'backwards'});
            break;
        }
        break;
      case "NAVIGATE_FORWARD":
        switch(this.navistate){
          case "ground":
            this.current_button++;
            if( this.current_button >= this.button_mapping.length ){
              this.current_button = this.button_mapping.length - 1;
            }
            this.updateDom(0);
            break;
          case "volume":
            this.config.volume += 10;
            if(this.config.volume > 100) this.config.volume = 100;
            document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume"
                                                            + Math.floor(this.config.volume / 25)
                                                            + ".svg";
            if(this.config.volume == 0){
              document.getElementById("volume_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/volume_off.svg";
            }
            document.getElementById("inner_volume_slider"+self.identifier).style.width = this.config.volume + "%";
            this.sendSocketNotification("VOLUMECHANGE", this.config.volume);
            break;
          case "source":
            this.source_menu_selected++;
            if(this.source_menu_selected == this.sourceMenuLength) this.source_menu_selected=this.sourceMenuLength-1;
            if(self.source_menu_selected > self.source_menu_viewport_pos + self.config.maxMenuEntries){
              this.source_menu_viewport_pos++;
              if(self.source_menu_viewport_pos > self.source_menu_length - self.config.maxMenuEntries - 1) self.source_menu_viewport_pos = self.source_menu_length - self.config.maxMenuEntries - 1;
              this.update_source_menu_viewport();
            }
            this.selectSourceEntry();
            //Log.log("MenuIndex: Searching for " + this.source_menu_selected);
            //this.resetSourceMenuSelected();
            //this.getMenuEntryByIndex(this.source_menu_selected, this.source_menu).className = "sourcemenuEntry_selected";
            break;
          case "duration":
            if(this.playerstate == "playing")
              this.sendSocketNotification("TIMECHANGE",{direction: 'forward'});
            break;
        }
        break;
      case "NAVIGATE_OK":
        switch(this.navistate){
          case "ground":
            var active_element = this.button_mapping[this.current_button];
            switch(active_element.className){
              case "play":
                this.button_action_play();
                break;

              case "back":
                this.button_action_back();
                break;
              case "next":
                this.button_action_next();
                break;

              case "stop":
                this.button_action_stop();
                break;

              case "loop":
                this.button_action_loop();
                break;

              case "shuffle":
                this.button_action_shuffle();
                break;
              
              case "source":
                this.button_action_source("navi");
                break;

              case "volume":
                this.button_action_volume("navi");
                break;

              case "table_col_timeslider":
                this.navistate = "duration";
                document.getElementById("duration_progressbar"+self.identifier).style.border = "4px solid #fff";
                document.getElementById("duration_progressbar"+self.identifier).style.margin = "3px";
                break;
            }
            break;

          case "volume":
            this.button_action_volume("navi");
            break;

          case "source":
            this.button_action_source("navi");
            break;

          case "duration":
            this.navistate = "ground";
            document.getElementById("duration_progressbar"+self.identifier).style.border = "2px solid #fff";
            document.getElementById("duration_progressbar"+self.identifier).style.margin = "5px";
            break;
        }
        break;
    }
  },

  socketNotificationReceived: function(notification, payload) {
    var self=this;
    switch(notification){
      case "INITIALIZE":
        self.playlists = payload.playlists;
        self.folder_structure = payload.folder_structure;
        Log.log("PlaylistList: "+self.playlists.length);
        self.buildSourceMenu(self.source_menu);
        break;
      case "LOADEDPLAYLIST":
        this.playlist = payload.playlist;
        this.current_song = 0;
        document.getElementById("currentsong_text"+self.identifier).innerHTML = this.playlist[0].title + " - " + this.playlist[0].interpret;
        document.getElementById("sourcetext"+self.identifier).innerHTML = payload.name;
        break;
      case "NEWFILE":
        document.getElementById("currentsong_text"+self.identifier).innerHTML = payload.title + " - " + payload.interpret;
        this.current_song = payload.tracknumber;
        break;
      case "UPDATE_POSITION": //payload { pos(sec), duration(sec), stop(bool)}
        if(payload.stop){
          document.getElementById("duration_inner_progressbar"+self.identifier).style.width = "0%";
          self.playerstate = "stopped";
          document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/play.svg";
        } else if(payload.start){
          document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/pause.svg";
          self.playerstate = "playing";
        } else {
          document.getElementById("duration_inner_progressbar"+self.identifier).style.width = payload.pos/payload.duration*100 + "%";
        }
        break;
      case "LOADINGERROR":
        self.playerstate = "stopped";
        document.getElementById("play_button"+self.identifier).src = "MMM-SMP-Simple-Music-Player/play.svg";
        self.sendNotification("SHOW_ALERT", {type: "notification", title: "Loading Error", message: "Could not load file"});
        break;
    }
  },

	notificationReceived: function(notification, payload, sender){
    /*if(notification === 'DOM_OBJECTS_CREATED'){
      this.hide(10, { lockString: "MMM-Serial-Connector" });
    }*/
    switch(notification) {
      case "NAVIGATE_BACK":
      case "NAVIGATE_FORWARD":
      case "NAVIGATE_OK":
        this.clicking_active = false;
        this.naviAction(notification);
        break;
    }
  },

});
