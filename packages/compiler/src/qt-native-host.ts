export const qtHostArtifacts = [
  {
    path: '.proto-ui/qt/QtNativeHost.h',
    kind: 'source' as const,
    contents: `#pragma once
#include <QQuickItem>
#include <QPointer>
#include <QEvent>
#include <QVariantMap>

// Native physical item, not a semantic Runtime. Accessibility reads current Qt facts.
class QtNativeNode : public QQuickItem {
    Q_OBJECT
    Q_PROPERTY(QVariantMap facts READ facts WRITE setFacts NOTIFY factsChanged)
public:
    explicit QtNativeNode(QQuickItem *parent = nullptr);
    ~QtNativeNode() override;
    QVariantMap facts() const { return facts_; }
    void setFacts(const QVariantMap &value);
    Q_INVOKABLE void notifyAccessibleName();
    Q_INVOKABLE void notifyAccessibleFocus();
signals:
    void factsChanged();
    void nativeAccessibleAction(const QString &name);
private:
    QVariantMap facts_;
};

class QtNativeInputEvent : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString key MEMBER key CONSTANT)
    Q_PROPERTY(QString text MEMBER text CONSTANT)
    Q_PROPERTY(int modifiers MEMBER modifiers CONSTANT)
    Q_PROPERTY(int button MEMBER button CONSTANT)
    Q_PROPERTY(bool isAutoRepeat MEMBER isAutoRepeat CONSTANT)
    Q_PROPERTY(bool accepted READ accepted WRITE setAccepted)
    Q_PROPERTY(qreal x MEMBER x CONSTANT)
    Q_PROPERTY(qreal y MEMBER y CONSTANT)
public:
    explicit QtNativeInputEvent(QEvent *event, QObject *parent=nullptr);
    QString key, text;
    int modifiers=0, button=0;
    bool isAutoRepeat=false;
    qreal x=0, y=0;
    bool accepted() const { return prevented_; }
    void setAccepted(bool value);
    bool prevented() const { return prevented_; }
    void close() { event_=nullptr; }
private:
    QEvent *event_;
    bool prevented_=false;
};

class QtNativeInputObserver : public QObject {
    Q_OBJECT
    Q_PROPERTY(QQuickItem* root READ root WRITE setRoot NOTIFY rootChanged)
public:
    explicit QtNativeInputObserver(QObject *parent=nullptr);
    ~QtNativeInputObserver() override;
    QQuickItem *root() const { return root_; }
    void setRoot(QQuickItem *value);
signals:
    void rootChanged();
    void observed(const QString &name, QObject *event);
protected:
    bool eventFilter(QObject *watched, QEvent *event) override;
private:
    QPointer<QQuickItem> root_;
    bool pointerHeld_=false;
    QPointF pointerStart_;
};
void registerQtNativeTypes();
`,
  },
  {
    path: '.proto-ui/qt/QtNativeHost.cpp',
    kind: 'source' as const,
    contents: `#include "QtNativeHost.h"
#include <QGuiApplication>
#include <QQuickWindow>
#include <QQmlEngine>
#include <QAccessible>
#include <QAccessibleObject>
#include <QAccessibleActionInterface>
#include <QAccessibleTableInterface>
#include <QAccessibleTableCellInterface>
#include <QKeyEvent>
#include <QMouseEvent>
#include <QContextMenuEvent>
#include <QTouchEvent>
#include <QInputMethodEvent>
#include <QStyleHints>
#include <QSet>
#include <qqml.h>

static QList<QPointer<QtNativeNode>> nativeNodes;
static QList<QPointer<QtNativeInputObserver>> nativeObservers;

class QtNodeAccessible : public QAccessibleObject, public QAccessibleActionInterface, public QAccessibleTableInterface, public QAccessibleTableCellInterface {
public:
    explicit QtNodeAccessible(QtNativeNode *node) : QAccessibleObject(node) {}
    QtNativeNode *node() const { return qobject_cast<QtNativeNode*>(object()); }
    QList<QtNativeNode*> referencedNodes(const QVariant &target) const {
        QVariantList refs=target.toList();if(refs.isEmpty())refs.append(target);
        QList<QtNativeNode*> result;
        for(const QVariant &reference:refs){QObject *object=reference.value<QObject*>();if(!object)object=reference.toMap().value("nativeOwner").value<QObject*>();const QStringList ids=reference.toString().split(' ',Qt::SkipEmptyParts);
            for(const auto &candidate:nativeNodes)if(candidate&&candidate->isVisible()&&(ids.contains(candidate->facts().value("id").toString())||object==candidate||(object&&object->property("nativeRoot").value<QObject*>()==candidate)))if(!result.contains(candidate))result.append(candidate);
        }
        return result;
    }
    QList<QQuickItem*> nodes(QQuickItem *parent) const {
        QList<QQuickItem*> result;
        for (QQuickItem *item : parent->childItems()) {
            if (!item->isVisible()) continue;
            if(auto *native=qobject_cast<QtNativeNode*>(item))if(native->facts().value("hidden").toBool()||native->facts().value("accessibleIgnored").toBool())continue;
            if (qobject_cast<QtNativeNode*>(item)) result.append(item);
            else result.append(nodes(item));
        }
        return result;
    }
    QAccessibleInterface *parent() const override {
        if (!node()) return nullptr;
        if(QObject *logical=node()->property("logicalNativeParent").value<QObject*>())if(logical!=node())return QAccessible::queryAccessibleInterface(logical);
        for (QQuickItem *item=node()->parentItem(); item; item=item->parentItem())
            if (qobject_cast<QtNativeNode*>(item)) return QAccessible::queryAccessibleInterface(item);
        return node()->window() ? QAccessible::queryAccessibleInterface(node()->window()) : nullptr;
    }
    QList<QQuickItem*> accessibleChildren() const {
        if(!node()||node()->facts().value("mergeChildren").toBool())return {};
        QList<QQuickItem*> result=nodes(node());
        for(const auto &candidate:nativeNodes)if(candidate&&candidate->isVisible()&&candidate->property("logicalNativeParent").value<QObject*>()==node()&&!result.contains(candidate))result.append(candidate);
        return result;
    }
    int childCount() const override { return accessibleChildren().size(); }
    QAccessibleInterface *child(int index) const override {
        if (!node() || node()->facts().value("mergeChildren").toBool()) return nullptr;
        const auto list=accessibleChildren();
        return index>=0 && index<list.size() ? QAccessible::queryAccessibleInterface(list[index]) : nullptr;
    }
    int indexOfChild(const QAccessibleInterface *child) const override {
        if (!node() || !child) return -1;
        const auto list=accessibleChildren();
        return list.indexOf(qobject_cast<QQuickItem*>(child->object()));
    }
    QRect rect() const override {
        if (!node() || !node()->window()) return {};
        const QPointF local=node()->mapToScene(QPointF(0,0));
        return QRect(node()->window()->mapToGlobal(local.toPoint()), QSize(qRound(node()->width()),qRound(node()->height())));
    }
    QWindow *window() const override { return node() ? node()->window() : nullptr; }
    QString text(QAccessible::Text type) const override {
        if (!node()) return {};
        const auto facts=node()->facts();
        if (type==QAccessible::Name) {
            if (facts.contains("name")) return facts.value("name").toString();
            const auto links=facts.value("tableRelations").toMap().value("labelledBy");QStringList labels;
            for(QtNativeNode *target:referencedNodes(links)){QVariant result;QMetaObject::invokeMethod(target,"subtreeText",Q_RETURN_ARG(QVariant,result));const QString label=target->facts().contains("name")?target->facts().value("name").toString():result.toString();if(!label.isEmpty())labels.append(label);}
            if(!labels.isEmpty())return labels.join(' ');
            if (facts.value("nameFromContent").toBool()) {
                QVariant result;
                QMetaObject::invokeMethod(node(), "subtreeText", Q_RETURN_ARG(QVariant,result));
                return result.toString();
            }
            return node()->property("contentText").toString();
        }
        if (type==QAccessible::Description) return facts.value("description").toString();
        if (type==QAccessible::Value) return facts.contains("value")?facts.value("value").toString():node()->property("contentText").toString();
        return {};
    }
    QAccessible::Role role() const override {
        if (!node()) return QAccessible::NoRole;
        const QString role=node()->facts().value("role").toString();
        if(role=="button")return QAccessible::Button;
        if(role=="checkbox")return QAccessible::CheckBox;
        if(role=="radio")return QAccessible::RadioButton;
        if(role=="textbox")return QAccessible::EditableText;
        if(role=="img")return QAccessible::Graphic;
        if(role=="slider")return QAccessible::Slider;
        if(role=="link")return QAccessible::Link;
        if(role=="tree")return QAccessible::Tree;
        if(role=="treeitem")return QAccessible::TreeItem;
        if(role=="list")return QAccessible::List;
        if(role=="listitem")return QAccessible::ListItem;
        if(role=="dialog")return QAccessible::Dialog;
        if(role=="tab")return QAccessible::PageTab;
        if(role=="table")return QAccessible::Table;
        if(role=="row")return QAccessible::Row;
        if(role=="cell")return QAccessible::Cell;
        if(role=="columnheader")return QAccessible::ColumnHeader;
        if(role=="rowheader")return QAccessible::RowHeader;
        if(role=="caption" || node()->property("tag").toString()=="Text")return QAccessible::StaticText;
        return QAccessible::Client;
    }
    QAccessible::State state() const override {
        QAccessible::State state;
        if(!node()){state.invalid=true;return state;}
        const auto facts=node()->facts();
        state.disabled=!node()->isEnabled() || facts.value("disabled").toBool();
        state.invisible=!node()->isVisible() || facts.value("hidden").toBool();
        state.focusable=facts.value("focusable").toBool();state.focused=node()->property("nativeFocused").toBool();
        state.checkable=facts.contains("checked");state.checked=facts.value("checked").toBool();state.checkStateMixed=facts.value("checked").toString()=="mixed";
        state.pressed=facts.value("pressed").toBool();state.selected=facts.value("selected").toBool();
        state.readOnly=facts.value("readOnly").toBool();state.busy=facts.value("busy").toBool();
        state.multiLine=facts.value("multiLine").toBool();state.editable=role()==QAccessible::EditableText&&!state.readOnly;
        state.expandable=facts.contains("expanded");state.expanded=facts.value("expanded").toBool();state.collapsed=state.expandable&&!state.expanded;
        state.hasPopup=facts.value("hasPopup").toBool();state.modal=facts.value("modal").toBool();
        return state;
    }
    void *interface_cast(QAccessible::InterfaceType type) override {
        if(type==QAccessible::ActionInterface)return static_cast<QAccessibleActionInterface*>(this);
        if(type==QAccessible::TableInterface&&role()==QAccessible::Table)return static_cast<QAccessibleTableInterface*>(this);
        if(type==QAccessible::TableCellInterface&&(role()==QAccessible::Cell||role()==QAccessible::ColumnHeader||role()==QAccessible::RowHeader))return static_cast<QAccessibleTableCellInterface*>(this);
        return QAccessibleObject::interface_cast(type);
    }
    QStringList actionNames() const override {
        if (!node()) return {};
        return node()->facts().value("actions").toStringList();
    }
    QList<QPair<QAccessibleInterface*,QAccessible::Relation>> relations(QAccessible::Relation match=QAccessible::AllRelations) const override {
        QList<QPair<QAccessibleInterface*,QAccessible::Relation>> result;
        if(!node())return result;
        auto relations=node()->facts().value("relations").toMap();const auto tableRelations=node()->facts().value("tableRelations").toMap();for(auto it=tableRelations.begin();it!=tableRelations.end();++it)relations.insert(it.key(),QVariantMap{{"target",it.value()}});
        for(auto it=relations.begin();it!=relations.end();++it) {
            QAccessible::Relation relation;
            const QString key=it.key().toLower();
            if(key=="labelledby"||key=="caption"||key=="columnheaders"||key=="rowheaders")relation=QAccessible::Labelled;
            else if(key=="controls"||key=="owns")relation=QAccessible::Controller;
            else if(key=="controlledby")relation=QAccessible::Controlled;
            else continue;
            if(!(match&relation))continue;
            const QVariant target=it.value().toMap().value("target");
            for(QtNativeNode *candidate:referencedNodes(target))if(candidate!=node())result.append(qMakePair(QAccessible::queryAccessibleInterface(candidate),relation));
        }
        return result;
    }
    void doAction(const QString &name) override { if(node())emit node()->nativeAccessibleAction(name); }
    QStringList keyBindingsForAction(const QString &) const override { return {}; }
    QList<QtNativeNode*> descendants() const {
        QList<QtNativeNode*> result;
        if(!node())return result;
        for(const auto &candidate:nativeNodes) {
            if(!candidate||candidate==node())continue;
            QSet<QQuickItem*> seen;
            for(QQuickItem *parent=qobject_cast<QQuickItem*>(candidate->property("logicalNativeParent").value<QObject*>());parent&&!seen.contains(parent);parent=qobject_cast<QQuickItem*>(parent->property("logicalNativeParent").value<QObject*>())) {
                seen.insert(parent);
                if(parent==node()){result.append(candidate);break;}
                if(auto *native=qobject_cast<QtNativeNode*>(parent))if(native->facts().value("role").toString()=="table")break;
            }
        }
        return result;
    }
    int rowCount() const override {return node()?node()->facts().value("rowCount").toInt():0;}
    int columnCount() const override {return node()?node()->facts().value("columnCount").toInt():0;}
    QAccessibleInterface *cellAt(int row,int column) const override {
        if(row<0||column<0||row>=rowCount()||column>=columnCount())return nullptr;
        for(QtNativeNode *cell:descendants()) {
            const auto f=cell->facts();const QString role=f.value("role").toString();
            if(role!="cell"&&role!="columnheader"&&role!="rowheader")continue;
            const int r=f.value("rowIndex").toInt()-1,c=f.value("columnIndex").toInt()-1;
            if(row>=r&&row<r+qMax(1,f.value("rowSpan").toInt())&&column>=c&&column<c+qMax(1,f.value("columnSpan").toInt()))return QAccessible::queryAccessibleInterface(cell);
        }
        return nullptr;
    }
    QAccessibleInterface *caption() const override {for(QtNativeNode *item:descendants())if(item->facts().value("role").toString()=="caption")return QAccessible::queryAccessibleInterface(item);return nullptr;}
    QAccessibleInterface *summary() const override {return caption();}
    QString columnDescription(int column) const override {for(int r=0;r<rowCount();++r){auto *cell=cellAt(r,column);if(cell&&cell->role()==QAccessible::ColumnHeader)return cell->text(QAccessible::Name);}return {};}
    QString rowDescription(int row) const override {for(int c=0;c<columnCount();++c){auto *cell=cellAt(row,c);if(cell&&cell->role()==QAccessible::RowHeader)return cell->text(QAccessible::Name);}return {};}
    QList<QAccessibleInterface*> selectedCells() const override {QList<QAccessibleInterface*> result;for(QtNativeNode *item:descendants()){auto *cell=QAccessible::queryAccessibleInterface(item);if(cell&&cell->tableCellInterface()&&cell->state().selected)result.append(cell);}return result;}
    int selectedCellCount() const override {return selectedCells().size();}
    bool isColumnSelected(int column) const override {if(column<0||column>=columnCount()||rowCount()==0)return false;for(int r=0;r<rowCount();++r){auto *cell=cellAt(r,column);if(!cell||!cell->state().selected)return false;}return true;}
    bool isRowSelected(int row) const override {if(row<0||row>=rowCount()||columnCount()==0)return false;for(int c=0;c<columnCount();++c){auto *cell=cellAt(row,c);if(!cell||!cell->state().selected)return false;}return true;}
    QList<int> selectedColumns() const override {QList<int> result;for(int c=0;c<columnCount();++c)if(isColumnSelected(c))result.append(c);return result;}
    QList<int> selectedRows() const override {QList<int> result;for(int r=0;r<rowCount();++r)if(isRowSelected(r))result.append(r);return result;}
    int selectedColumnCount() const override {return selectedColumns().size();}
    int selectedRowCount() const override {return selectedRows().size();}
    bool selectLine(int index,bool row,bool selected) {
        if(index<0||index>=(row?rowCount():columnCount()))return false;
        for(int other=0;other<(row?columnCount():rowCount());++other) {
            auto *cell=cellAt(row?index:other,row?other:index);if(!cell)return false;
            if(cell->state().selected==selected)continue;
            auto *actions=cell->actionInterface();const QString action=selected?QStringLiteral("select"):QStringLiteral("unselect");
            if(!actions||!actions->actionNames().contains(action))return false;
            actions->doAction(action);if(cell->state().selected!=selected)return false;
        }
        return true;
    }
    bool selectColumn(int column) override {return selectLine(column,false,true);}
    bool selectRow(int row) override {return selectLine(row,true,true);}
    bool unselectColumn(int column) override {return selectLine(column,false,false);}
    bool unselectRow(int row) override {return selectLine(row,true,false);}
    void modelChange(QAccessibleTableModelChangeEvent *event) override {if(event)QAccessible::updateAccessibility(event);}
    bool isSelected() const override {return state().selected;}
    int columnExtent() const override {return node()?qMax(1,node()->facts().value("columnSpan").toInt()):1;}
    int rowExtent() const override {return node()?qMax(1,node()->facts().value("rowSpan").toInt()):1;}
    int columnIndex() const override {return node()?node()->facts().value("columnIndex").toInt()-1:-1;}
    int rowIndex() const override {return node()?node()->facts().value("rowIndex").toInt()-1:-1;}
    QAccessibleInterface *table() const override {for(auto *parent=this->parent();parent;parent=parent->parent())if(parent->role()==QAccessible::Table)return parent;return nullptr;}
    QList<QAccessibleInterface*> columnHeaderCells() const override {QList<QAccessibleInterface*> result;if(node())for(QtNativeNode *target:referencedNodes(node()->facts().value("tableRelations").toMap().value("columnHeaders")))result.append(QAccessible::queryAccessibleInterface(target));return result;}
    QList<QAccessibleInterface*> rowHeaderCells() const override {QList<QAccessibleInterface*> result;if(node())for(QtNativeNode *target:referencedNodes(node()->facts().value("tableRelations").toMap().value("rowHeaders")))result.append(QAccessible::queryAccessibleInterface(target));return result;}
};

QtNativeNode::QtNativeNode(QQuickItem *parent) : QQuickItem(parent) {nativeNodes.append(this);}
QtNativeNode::~QtNativeNode() {for(qsizetype i=nativeNodes.size();i>0;--i)if(nativeNodes[i-1]==this)nativeNodes.removeAt(i-1);}
void QtNativeNode::setFacts(const QVariantMap &value) {
    if (facts_==value) return;
    facts_=value;emit factsChanged();
    QAccessible::State changed;changed.disabled=true;changed.checked=true;changed.selected=true;changed.pressed=true;changed.expanded=true;changed.collapsed=true;changed.focusable=true;changed.busy=true;
    QAccessibleStateChangeEvent event(this,changed);QAccessible::updateAccessibility(&event);
    QAccessibleEvent nameEvent(this,QAccessible::NameChanged);QAccessible::updateAccessibility(&nameEvent);
}
void QtNativeNode::notifyAccessibleName() { QAccessibleEvent event(this,QAccessible::NameChanged);QAccessible::updateAccessibility(&event); }
void QtNativeNode::notifyAccessibleFocus() {
    QAccessible::State changed;changed.focused=true;QAccessibleStateChangeEvent stateEvent(this,changed);QAccessible::updateAccessibility(&stateEvent);
    if(property("nativeFocused").toBool()){QAccessibleEvent event(this,QAccessible::Focus);QAccessible::updateAccessibility(&event);}
}

QtNativeInputEvent::QtNativeInputEvent(QEvent *event,QObject *parent) : QObject(parent),event_(event) {
    if (auto *keyEvent=dynamic_cast<QKeyEvent*>(event)) {
        modifiers=int(keyEvent->modifiers());isAutoRepeat=keyEvent->isAutoRepeat();text=keyEvent->text();
        switch(keyEvent->key()) {
            case Qt::Key_Return:case Qt::Key_Enter:key="Enter";break;
            case Qt::Key_Space:key=" ";break;case Qt::Key_Escape:key="Escape";break;case Qt::Key_Tab:key="Tab";break;
            case Qt::Key_Left:key="ArrowLeft";break;case Qt::Key_Up:key="ArrowUp";break;case Qt::Key_Right:key="ArrowRight";break;case Qt::Key_Down:key="ArrowDown";break;
            default:key=text;break;
        }
    }
    if(auto *mouse=dynamic_cast<QMouseEvent*>(event)) {button=int(mouse->button());modifiers=int(mouse->modifiers());x=mouse->position().x();y=mouse->position().y();}
    if(auto *touch=dynamic_cast<QTouchEvent*>(event)) {
        button=int(Qt::LeftButton);modifiers=int(touch->modifiers());
        if(!touch->points().isEmpty()){x=touch->points().first().position().x();y=touch->points().first().position().y();}
    }
}
void QtNativeInputEvent::setAccepted(bool value) { if(!event_){qWarning("Qt input callback window is closed");return;}prevented_=value;if(value)event_->accept(); }
QtNativeInputObserver::QtNativeInputObserver(QObject *parent) : QObject(parent) {nativeObservers.append(this);qApp->installEventFilter(this);}
QtNativeInputObserver::~QtNativeInputObserver() {nativeObservers.removeAll(this);if(qApp)qApp->removeEventFilter(this);}
void QtNativeInputObserver::setRoot(QQuickItem *value) {if(root_==value)return;root_=value;pointerHeld_=false;emit rootChanged();}
bool QtNativeInputObserver::eventFilter(QObject *watched,QEvent *event) {
    if(nativeObservers.isEmpty()||nativeObservers.last()!=this)return false;
    QList<QPointer<QtNativeInputObserver>> observers;
    for(const auto &observer:nativeObservers)if(observer&&observer->root_&&observer->root_->window()==watched)observers.append(observer);
    if(observers.isEmpty())return false;
    if(auto *mouse=dynamic_cast<QMouseEvent*>(event))if(mouse->source()!=Qt::MouseEventNotSynthesized)return false;
    QString name;
    switch(event->type()) {
        case QEvent::KeyPress:name="keydown";break;case QEvent::KeyRelease:name="keyup";break;
        case QEvent::MouseButtonPress:name="pointerdown";break;case QEvent::MouseButtonRelease:name="pointerup";break;case QEvent::MouseMove:name="pointermove";break;
        case QEvent::TouchBegin:name="pointerdown";break;case QEvent::TouchUpdate:name="pointermove";break;case QEvent::TouchEnd:name="pointerup";break;case QEvent::TouchCancel:name="pointercancel";break;
        case QEvent::ContextMenu:name="contextmenu";break;case QEvent::FocusIn:name="focus";break;case QEvent::FocusOut:name="blur";break;
        default:if(event->type()>=QEvent::User)name="event."+QString::number(int(event->type()));else return false;
    }
    QtNativeInputEvent payload(event);
    QQmlEngine::setObjectOwnership(&payload,QQmlEngine::CppOwnership);
    for(const auto &observer:observers)if(observer){
      if((event->type()==QEvent::MouseButtonPress||event->type()==QEvent::TouchBegin)&&payload.button==int(Qt::LeftButton)){observer->pointerHeld_=true;observer->pointerStart_=QPointF(payload.x,payload.y);}
      emit observer->observed(name,&payload);
    }
    if((event->type()==QEvent::MouseButtonRelease||event->type()==QEvent::TouchEnd)&&payload.button==int(Qt::LeftButton)) {
        for(const auto &observer:observers)if(observer){const bool commit=observer->pointerHeld_&&!payload.prevented()&&(QPointF(payload.x,payload.y)-observer->pointerStart_).manhattanLength()<=QGuiApplication::styleHints()->startDragDistance();observer->pointerHeld_=false;if(commit)emit observer->observed(QStringLiteral("click"),&payload);}
    }
    if(event->type()==QEvent::TouchCancel||event->type()==QEvent::FocusOut)for(const auto &observer:observers)if(observer)observer->pointerHeld_=false;
    const bool prevented=payload.prevented();payload.close();
    return prevented;
}
void registerQtNativeTypes() {
    qmlRegisterRevision<QQuickItem,1>("PuiQtNative",1,0);
    qmlRegisterType<QtNativeNode>("PuiQtNative",1,0,"NativeNode");
    qmlRegisterType<QtNativeInputObserver>("PuiQtNative",1,0,"NativeInputObserver");
    qmlRegisterUncreatableType<QtNativeInputEvent>("PuiQtNative",1,0,"NativeInputEvent","Input events are supplied by Qt");
    QAccessible::installFactory([](const QString &,QObject *object)->QAccessibleInterface* {
        auto *node=qobject_cast<QtNativeNode*>(object);
        return node ? new QtNodeAccessible(node) : nullptr;
    });
}
`,
  },
  {
    path: '.proto-ui/qt/main.cpp',
    kind: 'source' as const,
    contents: `#include "QtNativeHost.h"
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlError>
#include <QUrl>
#include <QDir>
#include <QFileInfo>
#include <QDebug>
int main(int argc,char **argv) {
    QGuiApplication app(argc,argv);
    registerQtNativeTypes();
    QQmlApplicationEngine engine;
    bool failed=false;
    QObject::connect(&engine,&QQmlEngine::warnings,&app,[&app,&failed](const QList<QQmlError> &errors){failed=true;for(const auto &error:errors)qCritical().noquote()<<error.toString();app.exit(1);});
    engine.load(QUrl::fromLocalFile(QFileInfo(argc>1 ? QString::fromLocal8Bit(argv[1]) : QStringLiteral("App.qml")).absoluteFilePath()));
    if(engine.rootObjects().isEmpty()||failed)return 1;
    return app.exec();
}
`,
  },
  {
    path: 'CMakeLists.txt',
    kind: 'source' as const,
    contents: `cmake_minimum_required(VERSION 3.16)
project(CompiledQtComponent LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
find_package(Qt6 6.4.2 EXACT REQUIRED COMPONENTS Core Gui Qml Quick)
add_executable(compiled-qt .proto-ui/qt/main.cpp .proto-ui/qt/QtNativeHost.cpp .proto-ui/qt/QtNativeHost.h)
target_link_libraries(compiled-qt PRIVATE Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick)
`,
  },
  {
    path: 'App.qml',
    kind: 'source' as const,
    contents: `import QtQuick 6.4
import QtQuick.Window 6.4
import "." as Generated
Window {
    width: 640; height: 480; visible: true
    Generated.Component { id: compiled; anchors.centerIn: parent }
}
`,
  },
];
