#!/usr/bin/env bash

source lib.sh

DOTFILES="$(pwd)"

awesome_header

get_linkables() {
    find -H "$DOTFILES" -maxdepth 3 -name '*.symlink'
}

backup() {
    BACKUP_DIR=$HOME/dotfiles-backup

    running "Creating backup directory at $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    for file in $(get_linkables); do
        filename=".$(basename "$file" '.symlink')"
        target="$HOME/$filename"
        if [ -f "$target" ]; then
            action "backing up $filename"
            cp "$target" "$BACKUP_DIR"
        else
            warning "$filename does not exist at this location or is a symlink"
        fi
    done
}


setup_symlinks() {
    create_symlink() {
        local source=$1
        local target=$2

        if [ -L "$target" ]; then
            action "~${target#$HOME} already exists... Skipping."
        else
            action "Creating symlink for $source"
            ln -s "$source" "$target"
        fi
    }

    running "Creating symlinks"

    for file in $(get_linkables) ; do
        target="$HOME/.$(basename "$file" '.symlink')"
        create_symlink "$file" "$target"
    done

    # karabiner - it needs to be put under .config folder
    target="$HOME/.config/karabiner.edn"
    create_symlink "$DOTFILES/karabiner/karabiner.edn" "$target"

}

setup_xcode() {
  running "checking Xcode CLI install"
  xcode_select="xcode-select --print-path"
  xcode_install=$($xcode_select) 2>&1 > /dev/null
  if [[ $? != 0 ]]; then
      bot "You are missing the Xcode CLI tools. I'll launch the install for you, but then you'll have to restart the process again."
      running "After that you'll need to paste the command and press Enter again."

      read -r -p "Let's go? [y|N] " response
      if [[ $response =~ ^(y|yes|Y) ]];then
          xcode-select --install
      fi

      exit -1
  fi
  ok
}

setup_git() {
    running "Setting up Git"

    defaultName=$(git config user.name)
    defaultEmail=$(git config user.email)
    defaultGithub=$(git config github.user)

    read -rp "Name [$defaultName] " name
    read -rp "Email [$defaultEmail] " email
    read -rp "Github username [$defaultGithub] " github

    git config -f ~/.gitconfig-local user.name "${name:-$defaultName}"
    git config -f ~/.gitconfig-local user.email "${email:-$defaultEmail}"
    git config -f ~/.gitconfig-local github.user "${github:-$defaultGithub}"

    if [[ "$(uname)" == "Darwin" ]]; then
        git config --global credential.helper "osxkeychain"
    else
        read -rn 1 -p "Save user and password to an unencrypted file to avoid writing? [y/N] " save
        if [[ $save =~ ^([Yy])$ ]]; then
            git config --global credential.helper "store"
        else
            git config --global credential.helper "cache --timeout 3600"
        fi
    fi
}

setup_homebrew() {
    running "Setting up Homebrew"

    if test ! "$(command -v brew)"; then
        action "Homebrew not installed. Installing."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    # install brew dependencies from Brewfile
    brew bundle

    # install fzf
    echo -e
    action "Installing fzf"
    "$(brew --prefix)"/opt/fzf/install --key-bindings --completion --no-update-rc --no-bash --no-fish
}

setup_shell() {
    running "Configuring shell"

    [[ -n "$(command -v brew)" ]] && zsh_path="$(brew --prefix)/bin/zsh" || zsh_path="$(which zsh)"
    if ! grep "$zsh_path" /etc/shells; then
        action "adding $zsh_path to /etc/shells"
        echo "$zsh_path" | sudo tee -a /etc/shells
    fi

    if [[ "$SHELL" != "$zsh_path" ]]; then
        chsh -s "$zsh_path"
        action "default shell changed to $zsh_path"
    fi
}

setup_macos() {
    running "Configuring macOS"
    if [[ "$(uname)" == "Darwin" ]]; then

        echo "only use UTF-8 in Terminal.app"
        defaults write com.apple.terminal StringEncodings -array 4

        echo "expand save dialog by default"
        defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true

        echo "Enable full keyboard access for all controls (e.g. enable Tab in modal dialogs)"
        defaults write NSGlobalDomain AppleKeyboardUIMode -int 3

        echo "Enable subpixel font rendering on non-Apple LCDs"
        defaults write NSGlobalDomain AppleFontSmoothing -int 2

        echo "Disable press-and-hold for keys in favor of key repeat"
        defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

        echo "Set a shorter Delay until key repeat"
        defaults write NSGlobalDomain InitialKeyRepeat -int 15

        echo "Enable Safari’s debug menu"
        defaults write com.apple.Safari IncludeInternalDebugMenu -bool true

        ################################################################################
        # Trackpad, mouse, keyboard, Bluetooth accessories, and input
        ###############################################################################
        echo "Set a blazingly fast keyboard repeat rate"
        defaults write NSGlobalDomain KeyRepeat -int 1

        echo "Increasing sound quality for Bluetooth headphones/headsets"
        defaults write com.apple.BluetoothAudioAgent "Apple Bitpool Min (editable)" -int 40

        echo "Disabling press-and-hold for special keys in favor of key repeat"
        defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

        echo "Enable tap to click (Trackpad) (NOT WORKING)"
        # defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true

        ################################################################################
        # SCREEN
        ################################################################################
        echo "Requiring password immediately after sleep or screen saver begins"
        defaults write com.apple.screensaver askForPassword -int 1
        defaults write com.apple.screensaver askForPasswordDelay -int 0


        ################################################################################
        # FINDER
        ################################################################################
        echo "Use column view in all Finder windows by default"
        defaults write com.apple.finder FXPreferredViewStyle Clmv

        echo "Show Path bar in Finder"
        defaults write com.apple.finder ShowPathbar -bool true

        echo "Show Status bar in Finder"
        defaults write com.apple.finder ShowStatusBar -bool true

        echo "Use current directory as default search scope in Finder"
        defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

        echo "show the ~/Library folder in Finder"
        chflags nohidden ~/Library

        echo "show hidden files by default"
        defaults write com.apple.Finder AppleShowAllFiles -bool false

        ################################################################################
        # DOCK
        ################################################################################

        echo "Wipe all (default) app icons from the Dock"
        defaults write com.apple.dock persistent-apps -array

        echo "Setting Dock icon size"
        defaults write com.apple.dock tilesize -int 36

        echo "Kill affected applications"

        for app in Safari Finder Dock Mail SystemUIServer; do killall "$app" >/dev/null 2>&1; done
    else
        warning "macOS not detected. Skipping."
    fi
}

case "$1" in
    backup)
        backup
        ;;
    link)
        setup_symlinks
        ;;
    git)
        setup_git
        ;;
    homebrew)
        setup_homebrew
        ;;
    shell)
        setup_shell
        ;;
    macos)
        setup_macos
        ;;
    xcode)
        setup_xcode
        ;;
    all)
        setup_symlinks
        setup_homebrew
        setup_shell
        setup_git
        setup_macos
        setup_xcode
        ;;
    *)
        echo -e $"\nUsage: $(basename "$0") {backup|link|git|homebrew|shell|macos|xcode|all}\n"
        exit 1
        ;;
esac

echo -e
ok "Done."
