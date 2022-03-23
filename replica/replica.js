/**
 * Replica plugin.
 */
Draw.loadPlugin(function(ui) {
    // Adds resource for action.
    mxResources.parse('replicaAction=Replicate');

    // Adds action.
    ui.actions.addAction('replicaAction', function() {
        replicate(ui);
    });

    // Adds toolbar button.
    ui.toolbar.addSeparator();
    var item = ui.toolbar.addItem('', 'replicaAction');
    item.firstChild.style.backgroundImage = 'url(https://www.draw.io/images/logo-small.gif)';
    item.firstChild.style.backgroundPosition = '2px 3px';
});

function replicate(ui) {
    var targetCells = collectTargetCellsForReplicate(ui);
    ui.editor.graph.getModel().beginUpdate();
    try {
        updateReplicaCells(ui, targetCells);
    } finally {
        ui.editor.graph.getModel().endUpdate();
    }
}

function updateReplicaCells(ui, targetCells) {
    for (var i in targetCells.replicas) {
        updateReplicaCell(ui, targetCells.replicas[i], targetCells.replicaOriginals);
    }
}

function updateReplicaCell(ui, replicaCell, replicaOriginalCells) {
    var name = replicaCell.value.attributes.replica.value;
    if (!replicaOriginalCells[name]) {
        return; // no original
    }
    updateReplicaCellGraph(ui, replicaCell, replicaOriginalCells[name]);
}

function updateReplicaCellGraph(ui, replicaCell, replicaOriginalCell) {
    var graph = ui.editor.graph;
    //console.log("replicaCell", replicaCell, "replicaOriginalCell", replicaOriginalCell);

    // Remove replica children.
    var removed = removeReplicatedCells(ui, replicaCell.children);

    // Insert cloned original into replica children.
    var clonedCell = graph.cloneCell(replicaOriginalCell);
    graph.getModel().add(replicaCell, clonedCell);
    clonedCell.geometry.x = (removed.cell)? removed.cell.geometry.x : 0;
    clonedCell.geometry.y = (removed.cell)? removed.cell.geometry.x : 0;
    replicaCell.geometry.width  = Math.max(replicaCell.geometry.width,  clonedCell.geometry.x + clonedCell.geometry.width);
    replicaCell.geometry.height = Math.max(replicaCell.geometry.height, clonedCell.geometry.x + clonedCell.geometry.height);

    // Restore cell order.
    var order = replicaCell.getIndex(clonedCell);
    var count = Math.abs(order - removed.order);
    var back  = (order >= removed.order);
    for (var i = 0; i < count; i++) {
        graph.orderCells(back, [clonedCell]);
    }

    // Configure cloned cell.
    configureClonedCell(clonedCell);

    ui.editor.graph.view.viewStateChanged();
    //console.log("replicaCell", replicaCell, "clonedCell", clonedCell);
}

function collectTargetCellsForReplicate(ui) {
    loadPages(ui);
    var targetCells = {replicas:[], replicaOriginals:{}};
    for (var i in ui.pages) {
        traverseCells(ui.pages[i].root, collectTargetCellForReplicate, targetCells);
    }
    return targetCells;
}

function collectTargetCellForReplicate(cell, targetCells) {
    if (cell.value && cell.value.attributes) {
        if (cell.value.attributes.replica) { // attribute "replica"
            targetCells.replicas.push(cell);
            return false;
        } else if (cell.value.attributes.replica_original) { // attribute "replica_original"
            var name = cell.value.attributes.replica_original.value;
            targetCells.replicaOriginals[name] = cell;
            return false;
        }
    }
    return true;
}

function configureClonedCell(clonedCell) {
    // Set replicated attributes and undroppable.
    traverseCells(clonedCell, function(cell) {
        if (cell.value && (typeof cell.value == "object")) {
            var value = cell.value.getAttribute("replica_original");
            cell.value.removeAttribute("replica_original");
            cell.value.setAttribute("replicated", value);
        }

        cell.setStyle(cell.getStyle() + ";dropTarget=0");
        return true;
    });

    // Set children uneditable.
    traverseChildren(clonedCell, function(cell) {
        cell.setStyle(cell.getStyle() + ";editable=0");
        return true;
    });
}

function removeReplicatedCells(ui, cells) {
    var removed = {cell:null, order:0};
    var cells = cells || [];
    for (var i = cells.length - 1; i >= 0; i--) {
        var cell = cells[i];
        if (cell.value && (typeof cell.value == "object") && cell.hasAttribute("replicated")) {
            ui.editor.graph.removeCells([cell], false);
            removed.cell  = cell;
            removed.order = i;
            //console.log(cell);
        }
    }
    return removed;
}

function traverseCells(cell, matchFunc, data) {
    if (!matchFunc(cell, data)) {
        return;
    }
    traverseChildren(cell, matchFunc, data);
}

function traverseChildren(cell, matchFunc, data) {
    if (cell.children) {
        for (var i in cell.children) {
            traverseCells(cell.children[i], matchFunc, data);
        }
    }
}

function loadPages(ui) {
    var currentPage = ui.currentPage;
    for (var index in ui.pages) {
        loadPage(ui, ui.pages[index], false);
    }
    loadPage(ui, currentPage, true);
}

function loadPage(ui, page, force) {
    if (page == ui.currenPage
        || (!force && page.root != undefined)) {
        return;
    }
    ui.selectPage(page, true, null);
    //console.log("select", page);
}
