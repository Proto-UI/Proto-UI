export const qtNodeSource = `// Native Qt Quick presentation node. Authored render is never a declarative binding.
import QtQuick 6.4
import QtQuick.Window 6.4
import PuiQtNative 1.0
NativeNode {
    id: node
    property var owner: null
    property bool rootNode: false
    property string tag: "div"
    property string contentText: ""
    readonly property Window nativeWindow: node.Window.window
    readonly property Item logicalNativeParent: rootNode && owner ? owner.parentNativeRoot() : null
    readonly property Item logicalParent: rootNode && owner ? owner.getHost() : null
    property var projection: ({})
    property var authoredChildren: []
    property bool textDeclared: false
    property bool imageDeclared: false
    property bool scrollDeclared: false
    property string hitMode: "participating"
    property var overlayOptions: ({open:true})
    property var modalMask: null
    property int transitionTicket: 0
    property Item chromeSurface: null
    property string chromeAxis: "vertical"
    property var textOptions: ({})
    property var imageOptions: ({})
    property var scrollOptions: ({axes:"both"})
    property string editValue: ""
    property bool textSyncing: false
    property int imageGeneration: 0
    property bool multiline: textDeclared ? textOptions.lineMode === "multiline" : tag === "textarea" || tag === "TextEdit"
    property bool editing: textDeclared || tag === "input" || multiline || tag === "TextInput"
    property bool imaging: imageDeclared || tag === "img" || tag === "Image"
    readonly property bool nativeFocused: activeFocus || editor.activeFocus || multilineEditor.activeFocus
    readonly property Item childParent: scrollDeclared ? scroller.contentItem : node
    property int nativeRole: facts.role === "button" ? Accessible.Button : facts.role === "checkbox" ? Accessible.CheckBox : facts.role === "radio" ? Accessible.RadioButton : facts.role === "slider" ? Accessible.Slider : facts.role === "textbox" ? Accessible.EditableText : facts.role === "link" ? Accessible.Link : Accessible.Client
    readonly property real padLeft: projection.paddingLeft || 0
    readonly property real padTop: projection.paddingTop || 0
    readonly property real padRight: projection.paddingRight || 0
    readonly property real padBottom: projection.paddingBottom || 0
    opacity: projection.alpha === undefined ? 1 : projection.alpha
    visible: projection.shown !== false && facts.hidden !== true
    clip: projection.clipped === true
    enabled: facts.disabled !== true
    activeFocusOnTab: rootNode && facts.focusable === true && facts.navParticipation !== "none"
    implicitWidth: padLeft + padRight + Math.max(label.visible ? label.implicitWidth : 0, editor.visible ? editor.implicitWidth : 0, multilineEditor.visible ? multilineEditor.implicitWidth : 0, imaging ? imageVisual.implicitWidth : 0, childWidth())
    implicitHeight: padTop + padBottom + Math.max(label.visible ? label.implicitHeight : 0, editor.visible ? editor.implicitHeight : 0, multilineEditor.visible ? Math.max(1,textOptions.rows || 1)*(projection.fontSize || 16)*1.25 : 0, imaging ? imageVisual.implicitHeight : 0, childHeight())
    width: projection.fillWidth && parent ? parent.width : projection.fixedWidth === undefined || projection.fixedWidth < 0 ? Math.max(projection.minWidth || 0, implicitWidth) : projection.fixedWidth
    height: projection.fillHeight && parent ? parent.height : projection.fixedHeight === undefined || projection.fixedHeight < 0 ? Math.max(projection.minHeight || 0, implicitHeight) : projection.fixedHeight
    Accessible.role: nativeRole
    Accessible.name: facts.name || (facts.nameFromContent ? subtreeText() : "")
    Accessible.description: facts.description || ""
    Accessible.focusable: rootNode && facts.focusable === true
    Accessible.focused: nativeFocused
    Accessible.checkable: facts.checked !== undefined
    Accessible.checked: facts.checked === true
    Accessible.selected: facts.selected === true
    Accessible.pressed: facts.pressed === true
    Accessible.readOnly: facts.readOnly === true
    Accessible.ignored: facts.hidden === true || facts.accessibleIgnored === true
    Accessible.onPressAction: if (owner && rootNode) owner.accessibleAction("press")
    Accessible.onToggleAction: if (owner && rootNode) owner.accessibleAction("toggle")
    Accessible.onIncreaseAction: if (owner && rootNode) owner.accessibleAction("increase")
    Accessible.onDecreaseAction: if (owner && rootNode) owner.accessibleAction("decrease")
    onNativeAccessibleAction: (name) => { if (owner && rootNode) owner.accessibleAction(name) }
    function syncText(patch) { textSyncing=true; textDeclared=true; textOptions=patch; if(patch.value !== undefined)editValue=patch.value; textSyncing=false }
    function requestNativeFocus() { if(editing){if(multiline)multilineEditor.forceActiveFocus();else editor.forceActiveFocus()}else forceActiveFocus() }
    function focusDescendant(request) {
        for(var i=0;i<children.length;++i) {var child=children[i];if(!child.visible||!child.enabled)continue;if(child.activeFocusOnTab){child.forceActiveFocus();return true}if(child.focusDescendant&&child.focusDescendant(request))return true}
        return false
    }
    function clearNativeFocus() { focus=false; editor.focus=false; multilineEditor.focus=false }
    function syncImage(patch,generation) { imageDeclared=true; imageGeneration=generation; imageOptions=patch }
    function syncScroll(config) {
        scrollDeclared=true; scrollOptions=config
        for(var i=0;i<authoredChildren.length;++i) authoredChildren[i].parent=scroller.contentItem
        publishScroll()
    }
    function syncOverlay(config) {
        overlayOptions=config
        if(config.modal && config.open && nativeWindow && !modalMask) {
            modalMask=modalComponent.createObject(nativeWindow.contentItem,{width:nativeWindow.width,height:nativeWindow.height,z:node.z-1})
        } else if((!config.modal || !config.open) && modalMask) {modalMask.destroy();modalMask=null}
    }
    function startTransition(duration,ticket) { transitionTimer.stop(); transitionTicket=ticket; transitionTimer.interval=Math.max(0,duration); transitionTimer.start() }
    function cancelTransition() { transitionTimer.stop(); ++transitionTicket }
    function syncScrollChrome(surface,orientation,thumbRole) {
        chromeSurface=surface
        chromeAxis=orientation && orientation.get ? orientation.get() : orientation || "vertical"
        for(var i=0;i<authoredChildren.length;++i) {
            var child=authoredChildren[i]
            child.chromeSurface=surface; child.chromeAxis=chromeAxis
        }
        syncThumb()
    }
    function syncThumb() {
        if(!chromeSurface)return
        var snapshot=chromeSurface.scrollSnapshot(),axis=snapshot[chromeAxis]
        if(!axis)return
        if(chromeAxis === "horizontal") {width=parent.width*axis.visibleRatio;x=axis.position*(parent.width-width)/Math.max(1,snapshot.horizontal.maximum)}
        else {height=parent.height*axis.visibleRatio;y=axis.position*(parent.height-height)/Math.max(1,snapshot.vertical.maximum)}
    }
    function scrollSnapshot() {
        return {horizontal:{position:scroller.contentX,visibleRatio:scroller.contentWidth>0?Math.min(1,scroller.width/scroller.contentWidth):1,maximum:Math.max(0,scroller.contentWidth-scroller.width)},vertical:{position:scroller.contentY,visibleRatio:scroller.contentHeight>0?Math.min(1,scroller.height/scroller.contentHeight):1,maximum:Math.max(0,scroller.contentHeight-scroller.height)}}
    }
    function scrollRequest(request) {
        var horizontal=request.axis === "horizontal", current=horizontal?scroller.contentX:scroller.contentY
        var maximum=horizontal?Math.max(0,scroller.contentWidth-scroller.width):Math.max(0,scroller.contentHeight-scroller.height)
        var page=horizontal?scroller.width:scroller.height
        var next=request.kind === "by"?current+request.delta:request.kind === "page"?current+(request.direction === "before"?-page:page):request.kind === "to-end"?maximum:request.position*maximum
        next=Math.max(0,Math.min(maximum,next))
        if(horizontal)scroller.contentX=next;else scroller.contentY=next
        publishScroll()
    }
    function publishScroll() {
        if(!scrollDeclared||!owner)return
        function axis(position,content,viewport) {
            var maximum=Math.max(0,content-viewport)
            return {position:maximum>0?Math.max(0,Math.min(1,position/maximum)):0,visibleRatio:content>0?Math.min(1,viewport/content):1,canScrollBefore:position>0,canScrollAfter:position<maximum,atEnd:Math.abs(position-maximum)<=1}
        }
        owner.scrollFacts({axes:scrollOptions.axes || "both",horizontal:axis(scroller.contentX,scroller.contentWidth,scroller.width),vertical:axis(scroller.contentY,scroller.contentHeight,scroller.height),scrolling:scroller.moving,projection:scrollOptions.projection === "composed" ? "composed" : "system"})
        scrollPositionChanged()
    }
    Rectangle {
        anchors.fill: parent
        color: node.projection.background || "transparent"
        border.width: node.projection.borderWidth || 0
        border.color: node.projection.borderColor || "black"
        radius: node.projection.radius || 0
    }
    Flickable {
        id: scroller
        anchors.fill: parent
        visible: node.scrollDeclared
        clip: true
        contentWidth: Math.max(width,node.childWidth()+node.padLeft+node.padRight)
        contentHeight: Math.max(height,node.childHeight()+node.padTop+node.padBottom)
        flickableDirection: node.scrollOptions.axes === "horizontal" ? Flickable.HorizontalFlick : node.scrollOptions.axes === "vertical" ? Flickable.VerticalFlick : Flickable.HorizontalAndVerticalFlick
        onContentXChanged: node.publishScroll()
        onContentYChanged: node.publishScroll()
        onContentWidthChanged: node.publishScroll()
        onContentHeightChanged: node.publishScroll()
        onMovingChanged: node.publishScroll()
    }
    Timer {
        id: transitionTimer
        repeat: false
        onTriggered: if(node.owner)node.owner.transitionComplete(node.transitionTicket)
    }
    Component {
        id: modalComponent
        Rectangle {
            color: "#40000000"
            MouseArea {
                anchors.fill: parent
                onPressed: (mouse) => { if(node.owner)node.owner.globalNativeEvent("pointerdown",mouse); mouse.accepted=true }
            }
        }
    }
    Connections {
        target: node.chromeSurface
        function onScrollPositionChanged() { node.syncThumb() }
    }
    signal scrollPositionChanged()
    function subtreeText() {
        var result = contentText
        for (var i=0; i<authoredChildren.length; ++i) {
            var child = authoredChildren[i]
            if (child.subtreeText) result += " " + child.subtreeText()
        }
        return result.trim()
    }
    function childWidth() {
        var total=0, largest=0, gap=projection.gap || 0
        for (var i=0; i<authoredChildren.length; ++i) {
            var child=authoredChildren[i]
            total += child.width
            largest=Math.max(largest, child.width)
        }
        return projection.layout === "row" ? total + Math.max(0,authoredChildren.length-1)*gap : largest
    }
    function childHeight() {
        var total=0, largest=0, gap=projection.gap || 0
        for (var i=0; i<authoredChildren.length; ++i) {
            var child=authoredChildren[i]
            total += child.height
            largest=Math.max(largest,child.height)
        }
        return projection.layout === "row" ? largest : total + Math.max(0,authoredChildren.length-1)*gap
    }
    function layoutChildren() {
        var x=padLeft, y=padTop, gap=projection.gap || 0
        for (var i=0; i<authoredChildren.length; ++i) {
            var child=authoredChildren[i]
            child.x=x + (child.projection ? child.projection.marginLeft || 0 : 0)
            child.y=y + (child.projection ? child.projection.marginTop || 0 : 0)
            if (projection.layout === "row") x += child.width+gap
            else y += child.height+gap
        }
    }
    onProjectionChanged: layoutChildren()
    onAuthoredChildrenChanged: layoutChildren()
    onWidthChanged: {layoutChildren(); if(owner && rootNode)owner.geometryChanged()}
    onHeightChanged: {layoutChildren(); if(owner && rootNode)owner.geometryChanged()}
    onNativeFocusedChanged: if (owner && rootNode) {owner.focusChanged(nativeFocused);notifyAccessibleFocus()}
    Keys.priority: Keys.BeforeItem
    Keys.onPressed: (event) => { if (owner && rootNode && activeFocus) owner.nativeEvent("keydown", event) }
    Keys.onReleased: (event) => { if (owner && rootNode && activeFocus) owner.nativeEvent("keyup", event) }
    Text {
        id: label
        x: node.padLeft; y: node.padTop
        text: node.contentText
        visible: !node.editing && !node.imaging && text.length > 0
        color: node.projection.foreground || "black"
        font.pixelSize: node.projection.fontSize || 16
        font.weight: node.projection.weight || 400
        font.italic: node.projection.italic === true
        horizontalAlignment: node.projection.alignment === "center" ? Text.AlignHCenter : node.projection.alignment === "right" ? Text.AlignRight : Text.AlignLeft
        Accessible.ignored: node.rootNode && node.facts.nameFromContent === true
    }
    TextInput {
        id: editor
        x: node.padLeft; y: node.padTop
        width: Math.max(80,node.width-node.padLeft-node.padRight)
        visible: node.editing && !node.multiline
        text: node.textDeclared ? node.editValue : node.contentText
        enabled: node.textOptions.disabled !== true
        readOnly: node.facts.readOnly === true || node.textOptions.readOnly === true
        maximumLength: node.textOptions.maxLength === undefined ? 32767 : node.textOptions.maxLength
        inputMethodHints: node.textOptions.inputMode === "numeric" ? Qt.ImhDigitsOnly : node.textOptions.inputMode === "decimal" ? Qt.ImhFormattedNumbersOnly : node.textOptions.inputMode === "email" ? Qt.ImhEmailCharactersOnly : Qt.ImhNone
        color: node.projection.foreground || "black"
        font.pixelSize: node.projection.fontSize || 16
        selectByMouse: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: (event) => { if (node.owner) node.owner.nativeEvent("keydown",event) }
        Keys.onReleased: (event) => { if (node.owner) node.owner.nativeEvent("keyup",event) }
        onTextEdited: if (node.owner) node.owner.textEdited(text, preeditText)
        onPreeditTextChanged: if (node.owner) node.owner.compositionChanged(preeditText,text)
        onEditingFinished: if (node.owner) node.owner.textCommitted(text)
        onActiveFocusChanged: if (node.owner) node.owner.textFocusChanged(activeFocus)
    }
    TextEdit {
        id: multilineEditor
        x: node.padLeft; y: node.padTop
        width: Math.max(80,node.width-node.padLeft-node.padRight)
        height: Math.max(24,node.height-node.padTop-node.padBottom)
        visible: node.editing && node.multiline
        text: node.textDeclared ? node.editValue : node.contentText
        enabled: node.textOptions.disabled !== true
        readOnly: node.facts.readOnly === true || node.textOptions.readOnly === true
        wrapMode: node.textOptions.wrap === "hard" ? TextEdit.WrapAnywhere : TextEdit.Wrap
        color: node.projection.foreground || "black"
        font.pixelSize: node.projection.fontSize || 16
        selectByMouse: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: (event) => { if (node.owner) node.owner.nativeEvent("keydown",event) }
        Keys.onReleased: (event) => { if (node.owner) node.owner.nativeEvent("keyup",event) }
        onTextChanged: if (activeFocus && !node.textSyncing && text !== node.editValue && node.owner) node.owner.textEdited(text,preeditText)
        onPreeditTextChanged: if (node.owner) node.owner.compositionChanged(preeditText,text)
        onActiveFocusChanged: { if(node.owner){node.owner.textFocusChanged(activeFocus);if(!activeFocus)node.owner.textCommitted(text)} }
    }
    Image {
        id: imageVisual
        anchors.fill: parent
        visible: node.imaging
        source: node.imageOptions.source || node.facts.imageSource || ""
        asynchronous: true
        fillMode: node.imageOptions.fit === "cover" ? Image.PreserveAspectCrop : node.imageOptions.fit === "fill" ? Image.Stretch : Image.PreserveAspectFit
        Accessible.name: node.imageOptions.alternativeText || ""
        Accessible.ignored: node.imageOptions.a11yMode === "decorative"
        onStatusChanged: if (node.owner && node.imaging) node.owner.imageStatus(status, node.imageGeneration)
    }
    MouseArea {
        anchors.fill: parent
        enabled: (node.rootNode || node.chromeSurface !== null) && !node.editing && node.owner !== null && node.hitMode === "participating"
        acceptedButtons: Qt.AllButtons
        hoverEnabled: true
        preventStealing: false
        onPressed: (mouse) => { node.owner.nativeEvent("pointerdown",mouse) }
        onReleased: (mouse) => { node.owner.nativeEvent("pointerup",mouse) }
        onClicked: (mouse) => { node.owner.nativeEvent(mouse.button === Qt.RightButton ? "contextmenu" : "click",mouse) }
        onCanceled: node.owner.nativeEvent("pointercancel", {accepted:false})
        onPositionChanged: (mouse) => {
            if(node.chromeSurface && pressed) {
                var snapshot=node.chromeSurface.scrollSnapshot(),axis=snapshot[node.chromeAxis]
                var position=node.chromeAxis === "horizontal"?mouse.x:mouse.y
                var length=node.chromeAxis === "horizontal"?width:height
                node.chromeSurface.scrollRequest({kind:"control-drag",axis:node.chromeAxis,position:Math.max(0,Math.min(1,position/Math.max(1,length)))})
            }
            node.owner.nativeEvent("pointermove",mouse)
        }
        onEntered: node.owner.nativeEvent("pointerenter", {accepted:false})
        onExited: node.owner.nativeEvent("pointerleave", {accepted:false})
    }
    Component.onDestruction: { transitionTimer.stop(); if(modalMask)modalMask.destroy() }
}
`;
