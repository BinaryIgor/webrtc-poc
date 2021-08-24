const ONE_COLUMN_GRID = "one-column-grid";
const TWO_COLUMNS_GRID = "two-columns-grid";
const THREE_COLUMNS_GRID = "three-columns-grid";

const REGULAR_SPAN = "col-span-2";
const SPAN_2_2 = "col-2-span-2";
const SPAN_3_2 = "col-3-span-2"

function isLandscape() {
    return window.innerWidth > window.innerHeight;
}

export class VideoGridLayout {

    constructor(container, containerWidth = 90, containerHeight = 85) {
        this.container = container;
        this.containerWidth = containerWidth;
        this.containerHeight = containerHeight;
    }

    render() {
        this.landscape = isLandscape();
        this._setChildren();

        window.addEventListener("resize", () => {
            const newLandscape = isLandscape();
            if (newLandscape != this.landscape) {
                this.landscape = newLandscape;
                this.refresh();
            }
        });

        this._setContainerTemplate();

        this._updateVideosSize();
        this._updateChildrenColumnSpan();
    }

    _setChildren() {
        this.children = this.container.children;
        this.childrenCount = this.children.length;
    }

    refresh() {
        this._setChildren();
        this._setContainerTemplate();
        this._updateVideosSize();
        this._updateChildrenColumnSpan();
    }

    _setContainerTemplate() {
        this.container.classList.remove(...[ONE_COLUMN_GRID, TWO_COLUMNS_GRID, THREE_COLUMNS_GRID]);

        if (this._isOneColumnGrid()) {
            this.container.classList.add(ONE_COLUMN_GRID);
        } else if (this._isTwoColumnsGrid()) {
            this.container.classList.add(TWO_COLUMNS_GRID);
        } else {
            this.container.classList.add(THREE_COLUMNS_GRID);
        }
    }

    _isOneColumnGrid() {
        return (this.landscape && this.childrenCount <= 1) || (!this.landscape && this.childrenCount <= 2);
    }

    _isTwoColumnsGrid() {
        return (this.landscape && this.childrenCount <= 4) || (!this.landscape && this.childrenCount <= 6);
    }

    _isThreeColumnsGrid() {
        return (this.landscape && this.childrenCount > 4) || (!this.landscape && this.childrenCount > 6);
    }

    _updateChildrenColumnSpan() {
        for (let i = 0; i < this.childrenCount; i++) {
            const child = this.children[i];
            child.classList.remove(...[REGULAR_SPAN, SPAN_2_2, SPAN_3_2]);

            if (this._isSingleLastInTwoColumngsGrid(i)
                || this._isFirstOfTwoInThreeColumnsGrid(i)) {
                child.classList.add(SPAN_2_2);
            } else if (this._isFirstOfTwoInThreeColumnsGrid(i)
                || this._isSingleLastInThreeColumngsGrid(i)) {
                child.classList.add(SPAN_3_2);
            } else {
                child.classList.add(REGULAR_SPAN);
            }
        }
    }

    _isSingleLastInTwoColumngsGrid(idx) {
        return this._isTwoColumnsGrid() &&
            ((this.childrenCount == 3 && idx == 2) || (!this.landscape && this.childrenCount == 5 && idx == 4));
    }

    _isFirstOfTwoInThreeColumnsGrid(idx) {
        return this._isThreeColumnsGrid() &&
            ((this.landscape && this.childrenCount == 5 && idx == 3 || (this.childrenCount == 8 && idx == 6)));
    }

    _isSingleLastInThreeColumngsGrid(idx) {
        return this._isThreeColumnsGrid() && this.childrenCount == 7 && idx == 6;
    }

    _updateVideosSize() {
        let maxWidth;
        if (this._isOneColumnGrid()) {
            maxWidth = this.containerWidth;
        } else if (this._isTwoColumnsGrid()) {
            maxWidth = this.containerWidth / 2;
        } else {
            maxWidth = this.containerWidth / 3;
        }

        const videos = this.container.querySelectorAll("video");

        let maxHeight;
        if ((this.landscape && this.childrenCount <= 2) || (!this.landscape && this.childrenCount <= 1)) {
            maxHeight = this.containerHeight;
        } else if (this.childrenCount <= 4) {
            maxHeight = this.containerHeight / 2;
        } else {
            maxHeight = this.containerHeight / 3;
        }

        videos.forEach((v) => {
            v.style.maxWidth = `${maxWidth}vw`;
            v.style.maxHeight = `${maxHeight}vh`;
        });
    }
}