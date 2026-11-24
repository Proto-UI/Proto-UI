//! Construction measurements, not a performance budget or OS/GPU allocation claim.
//! The real GPUI window and allocator instrumentation are initialized before sampling.
use gpui::{prelude::*, px, size, Context, Entity, Render, TestAppContext, Window};
use proto_ui_gpui_native::gpui_native_owner::native_owner_allocation_count;
use serde_json::json;
use std::{alloc::{GlobalAlloc, Layout, System}, cell::Cell, time::Instant};

#[derive(Clone, Copy, Default)]
struct Counts { allocations:u64, reallocations:u64, deallocations:u64, requested_bytes:u64 }
thread_local! {
    static ENABLED:Cell<bool> = const { Cell::new(false) };
    static COUNTS:Cell<Counts> = const { Cell::new(Counts{allocations:0,reallocations:0,deallocations:0,requested_bytes:0}) };
}
struct CountingAllocator;
#[global_allocator]
static ALLOCATOR:CountingAllocator=CountingAllocator;
fn record(kind:u8,size:usize){
    if ENABLED.try_with(Cell::get).unwrap_or(false){
        let _=COUNTS.try_with(|counter|{let mut c=counter.get();match kind{
            0=>{c.allocations+=1;c.requested_bytes+=size as u64;},
            1=>{c.reallocations+=1;c.requested_bytes+=size as u64;},
            _=>c.deallocations+=1,
        }counter.set(c);});
    }
}
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self,layout:Layout)->*mut u8{let p=System.alloc(layout);if !p.is_null(){record(0,layout.size());}p}
    unsafe fn alloc_zeroed(&self,layout:Layout)->*mut u8{let p=System.alloc_zeroed(layout);if !p.is_null(){record(0,layout.size());}p}
    unsafe fn realloc(&self,p:*mut u8,layout:Layout,new_size:usize)->*mut u8{let n=System.realloc(p,layout,new_size);if !n.is_null(){record(1,new_size);}n}
    unsafe fn dealloc(&self,p:*mut u8,layout:Layout){record(2,layout.size());System.dealloc(p,layout);}
}
fn measure<T>(create:impl FnOnce()->T)->(T,Counts,u128){
    struct Disable;impl Drop for Disable{fn drop(&mut self){ENABLED.with(|enabled|enabled.set(false));}}
    COUNTS.with(|counter|counter.set(Counts::default()));
    let started=Instant::now();ENABLED.with(|enabled|{assert!(!enabled.replace(true));});
    let guard=Disable;let result=create();drop(guard);
    let nanos=started.elapsed().as_nanos();let counts=COUNTS.with(Cell::get);
    (result,counts,nanos)
}

#[test]
fn allocator_counter_measures_real_requests(){
    let (_,counts,_)=measure(||unsafe{
        let layout=Layout::from_size_align(128,8).unwrap();let p=std::alloc::alloc(layout);assert!(!p.is_null());
        let p=std::alloc::realloc(p,layout,256);assert!(!p.is_null());
        std::alloc::dealloc(p,Layout::from_size_align(256,8).unwrap());
    });
    assert_eq!((counts.allocations,counts.reallocations,counts.deallocations,counts.requested_bytes),(1,1,1,384));
}
struct Screen{tree:Option<Entity<subject::Tree>>}
impl Render for Screen{
    fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{
        gpui::div().size_full().children(self.tree.clone())
    }
}

#[gpui::test]
fn measures_exact_tree_construction_and_retirement(cx:&mut TestAppContext){
    // No output formatting, measurement Vec, window startup or post-layout work
    // is inside the thread-local allocator measurement window.
    ENABLED.with(|enabled|enabled.set(false));COUNTS.with(|counter|counter.set(Counts::default()));
    let window=cx.open_window(size(px(420.),px(240.)),|_,_|Screen{tree:None});
    for sample in 0..31 {
        let (row,owners)=window.update(cx,|screen,window,cx|{
            let before=native_owner_allocation_count();
            let (tree,counts,nanos)=measure(||subject::mount(window,cx));
            let resources=tree.read(cx).resource_counts(cx);
            let owners=tree.read(cx).owners(cx);
            assert_eq!(owners.len(),subject::OWNER_COUNT);
            assert_eq!(native_owner_allocation_count(),before+subject::OWNER_COUNT);
            subject::assert_resource_boundary(&resources);
            let row=json!({"case":subject::CASE,"sample":sample,"phase":if sample==0{"first construction in process"}else{"repeated construction"},
                "nanoseconds":nanos,"successfulAllocationCalls":counts.allocations,"successfulReallocationCalls":counts.reallocations,
                "deallocationCalls":counts.deallocations,"requestedBytesIncludingReallocation":counts.requested_bytes,
                "liveOwnerDelta":owners.len(),"resourcesAfterConstruction":resources});
            screen.tree=Some(tree);cx.notify();(row,owners)
        }).unwrap();
        for _ in 0..3{
            cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);}).unwrap();cx.run_until_parked();
        }
        let mut row=row;
        window.update(cx,|screen,window,cx|{
            let tree=screen.tree.as_ref().unwrap().clone();
            row["resourcesAfterLayout"]=tree.read(cx).resource_counts(cx);
            tree.update(cx,|tree,cx|tree.exercise(window,cx));
            tree.update(cx,|tree,cx|tree.retire(window,cx));
            for owner in &owners {assert!(owner.borrow().disposed,"terminal cleanup");}
            screen.tree=None;cx.notify();
        }).unwrap();
        drop(owners);
        for _ in 0..3{
            cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);}).unwrap();cx.run_until_parked();
        }
        window.update(cx,|_,_,_|{
            assert_eq!(native_owner_allocation_count(),0,"no live owner remains between samples");
        }).unwrap();
        println!("native-cost-sample {}",row);
    }
}
