import QtQuick 6.4
import QtQuick.Window 6.4
import "." as Generated
Window {
    id: window
    width: 640; height: 480; visible: true
    property int stage: 0
    property var oldRoot: null
    property var owner: null
    property var oldExposes: null
    property int oldEpoch: 0
    property var siblingsRoot: null
    property var receipts: []
    Generated.Component {
        id: compiled
        Rectangle { width: 1600; height: 1600; color: "lightblue" }
    }
    Generated.TemplateDefault {
        id: defaultComponent; x: 300
        Rectangle { id: originalSlot; width: 30; height: 20; color: "coral" }
    }
    Generated.TemplateSiblings { id: siblingsComponent; x: 300; y: 150 }
    Generated.TemplateEmpty { id: emptyComponent; x: 300; y: 300 }
    function assert(value,message) { if(!value)throw new Error(message) }
    function record(name) { receipts.push({name:name,status:"passed"}); console.log("PUI_QT_CASE "+JSON.stringify(receipts[receipts.length-1])) }
    Timer {
        interval: 50; running: true; repeat: true
        onTriggered: {
            try {
                var exposes=compiled.getExposes()
                if(stage===0) {
                    var defaultRoot=defaultComponent.nativeRoot
                    assert(defaultComponent.present && defaultRoot.rootNode,"default setup retains host Root")
                    assert(defaultRoot.authoredChildren.length===1 && originalSlot.parent===defaultRoot.authoredChildren[0],"default render preserves the original native child through its anonymous slot")
                    assert(defaultRoot.width===160 && defaultRoot.height===80,"feedback belongs to host Root")
                    record("void setup preserves the original native slot child")
                    siblingsRoot=siblingsComponent.nativeRoot
                    assert(siblingsRoot.rootNode && siblingsRoot.authoredChildren.length===2,"sibling array is inside one Root")
                    var first=siblingsRoot.authoredChildren[0],second=siblingsRoot.authoredChildren[1]
                    assert(!first.rootNode && !second.rootNode && first!==siblingsRoot && second!==siblingsRoot,"template nodes never become Root")
                    assert(first.authoredChildren[0].contentText==="first" && second.authoredChildren[0].contentText==="second","sibling source order")
                    assert(first.width===32 && second.width===48 && siblingsRoot.width===160,"child and Root styles remain separate")
                    record("template sibling order and independent Root styles")
                    assert(emptyComponent.present && emptyComponent.nativeRoot.rootNode && emptyComponent.nativeRoot.authoredChildren.length===0,"empty output still retains host Root")
                    record("empty template retains its host Root")
                    siblingsComponent.setProps({children:false})
                    assert(compiled.present && compiled.nativeRoot!==null,"actual view mounted")
                    owner=compiled.logicalOwner; oldRoot=compiled.nativeRoot; oldEpoch=compiled.viewEpoch; oldExposes=exposes
                    var initial=exposes.snapshot()
                    assert(initial.axes==="vertical" && initial.projection==="system","actual vertical/system facts")
                    assert(oldRoot.width===240 && oldRoot.height===200,"240x200 native viewport")
                    assert(initial.vertical.visibleRatio>0 && initial.vertical.visibleRatio<1,"actual overflow")
                    record("initial native Flickable viewport and facts")
                    assert(exposes.pause().kind==="dispatched","pause uses the current native lease")
                    assert(exposes.middle().kind==="dispatched" && Math.abs(exposes.snapshot().vertical.position-0.5)<0.000001,"absolute request returns actual native delivery and facts")
                    assert(exposes.relative().kind==="dispatched" && exposes.snapshot().vertical.position>0.5,"relative native movement")
                    assert(exposes.pageBefore().kind==="dispatched" && exposes.snapshot().vertical.position<0.5,"native page movement")
                    assert(exposes.quarter().kind==="dispatched" && Math.abs(exposes.snapshot().vertical.position-0.25)<0.000001,"control request uses the same native engine")
                    record("position requests return native delivery outcomes and observed movement")
                    exposes.extra(); stage=1
                } else if(stage===1) {
                    assert(siblingsComponent.nativeRoot===siblingsRoot && siblingsComponent.present && siblingsRoot.authoredChildren.length===0,"explicit update replaces children without replacing Root")
                    record("explicit update preserves Root identity")
                    var horizontal=exposes.snapshot()
                    assert(horizontal.axes==="horizontal" && horizontal.projection==="system","axes-only sync retains projection")
                    assert(compiled.logicalOwner===owner && compiled.nativeRoot===oldRoot,"sync preserves owner and view")
                    assert(oldRoot.scrollOptions.endFollow.axis==="vertical" && oldRoot.scrollOptions.endFollow.mode==="while-at-end","sync retains follow policy")
                    exposes.same(); assert(exposes.snapshot().axes==="horizontal","missing axes no-op")
                    record("axes-only sync and unrelated policy preservation")
                    var before=exposes.snapshot().vertical.position,refusedAxis=exposes.middle()
                    assert(refusedAxis.kind==="rejected" && refusedAxis.reason==="unavailable" && exposes.snapshot().vertical.position===before,"inactive axis does not move its native engine")
                    record("inactive-axis requests reject without native movement")
                    compiled.setProps({present:false}); stage=2
                } else if(stage===2) {
                    assert(!compiled.present && compiled.nativeRoot===null,"view actually detached")
                    assert(exposes.snapshot().projection==="unresolved","detached physical fact")
                    var detached=exposes.middle()
                    assert(detached.kind==="rejected" && detached.reason==="not-mounted","detached request does not reach a retired native root")
                    record("detached requests reject without a stale native target")
                    exposes.both(); assert(exposes.snapshot().axes==="horizontal","detached intent does not forge facts")
                    compiled.setProps({present:true}); stage=3
                } else if(stage===3) {
                    assert(compiled.present && compiled.nativeRoot!==null && compiled.nativeRoot!==oldRoot,"replacement physical root")
                    assert(compiled.logicalOwner===owner && compiled.viewEpoch>oldEpoch,"same owner with new view epoch")
                    assert(exposes.snapshot().axes==="both","replacement adopts retained axes")
                    assert(exposes.snapshot().vertical.visibleRatio<1,"slot remains native and overflows after reconnect")
                    record("detach and same-owner replacement with retained intent")
                    assert(exposes.end().kind==="dispatched","replacement end request delivered")
                    var ended=exposes.snapshot()
                    assert(ended.vertical.atEnd && ended.vertical.position===1 && ended.endFollow.state==="following" && ended.endFollow.requestStatus==="applied","end outcome follows actual native application")
                    record("end request applies on the current replacement view")
                    compiled.dispose(); var refused=false
                    try { oldExposes.horizontal() } catch(error) { refused=true }
                    assert(refused && compiled.disposed && compiled.logicalOwner===null,"terminal old callable refusal")
                    record("terminal old callable refusal")
                    console.log("PUI_QT_RESULT "+JSON.stringify({passed:receipts.length,failed:0,cases:receipts,qt:"6.4.2",platform:"offscreen"}))
                    running=false; Qt.quit()
                }
            } catch(error) {
                running=false
                console.log("PUI_QT_RESULT "+JSON.stringify({passed:receipts.length,failed:1,stage:stage,error:String(error),cases:receipts}))
                throw error
            }
        }
    }
}
